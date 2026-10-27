import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../app.mjs'
import { memoryRepository, validInput } from './support/notesFixture.mjs'

// 외부 DB 경계만 대체한다. 실제 라우트·인증 검사·검증·응답은 HTTP로 실행한다.
async function fixture(t, initialUser = { id: 7, role: 'USER' }) {
  let user = initialUser
  const repository = memoryRepository()
  const app = createApp({
    repository,
    authenticate(req, res, next) {
      req.user = user
      next()
    },
  })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    repository,
    baseUrl,
    setUser(next) {
      user = next
    },
    async request(path, method = 'GET', body, headers = {}) {
      const response = await fetch(baseUrl + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return { status: response.status, body: await response.json() }
    },
  }
}

test('좌표와 내용을 저장하고 승인 후에만 공개 목록·상세에 나타난다', async (t) => {
  const f = await fixture(t)
  const created = await f.request('/api/notes', 'POST', {
    ...validInput,
    authorId: 999,
    status: 'APPROVED',
  })
  assert.equal(created.status, 201)
  assert.deepEqual(created.body, { id: 1, status: 'PENDING' })
  assert.equal(f.repository.notes[0].authorId, 7)
  assert.equal(f.repository.notes[0].latitude, 37.5665)
  assert.equal(f.repository.notes[0].longitude, 126.978)
  f.setUser(null)
  assert.deepEqual((await f.request('/api/notes')).body, [])
  assert.equal((await f.request('/api/notes/1')).status, 404)
  f.setUser({ id: 8, role: 'ADMIN' })
  assert.equal((await f.request('/api/admin/notes')).body.length, 1)
  const approved = await f.request('/api/admin/notes/1/status', 'PATCH', {
    status: 'APPROVED',
    expectedStatus: 'PENDING',
    reason: '확인 완료',
  })
  assert.equal(approved.status, 200)
  f.setUser(null)
  assert.deepEqual((await f.request('/api/notes')).body, [
    {
      id: 1,
      title: '보행로 관찰',
      tag: '조명 고장',
      latitude: 37.5665,
      longitude: 126.978,
    },
  ])
  const detail = (await f.request('/api/notes/1')).body
  assert.equal(detail.content, validInput.content)
  assert.equal(detail.observedDate, '2026-01-01')
  assert.equal(detail.locationName, '서울시 중구')
  assert.equal(detail.authorId, undefined)
  assert.equal(detail.moderationReason, undefined)
})

test('반려·숨김 글은 공개되지 않고 승인 복구는 즉시 반영된다', async (t) => {
  const f = await fixture(t, { id: 8, role: 'ADMIN' })
  await f.request('/api/notes', 'POST', validInput)
  await f.request('/api/notes', 'POST', validInput)
  const patch = (id, status, reason = '', expectedStatus) =>
    f.request(`/api/admin/notes/${id}/status`, 'PATCH', {
      status,
      reason,
      expectedStatus,
    })
  assert.equal((await patch(1, 'REJECTED')).status, 400)
  assert.equal((await patch(1, 'REJECTED', '위치 확인 필요')).status, 200)
  assert.equal((await f.request('/api/notes/1')).status, 404)
  assert.equal((await patch(1, 'APPROVED')).status, 409)
  assert.equal((await patch(2, 'APPROVED')).status, 200)
  assert.equal((await patch(2, 'HIDDEN', '현장 재확인')).status, 200)
  assert.deepEqual((await f.request('/api/notes')).body, [])
  assert.equal((await f.request('/api/notes/2')).status, 404)
  assert.equal((await patch(2, 'APPROVED', '', 'HIDDEN')).status, 200)
  assert.equal((await f.request('/api/notes')).body.length, 1)
  const admin = (await f.request('/api/admin/notes?status=REJECTED')).body
  assert.equal(admin[0].moderationReason, '위치 확인 필요')
})

test('미인증 작성·관리자 조회를 거절하고 일반 회원의 승인도 거절한다', async (t) => {
  const f = await fixture(t, null)
  assert.equal((await f.request('/api/notes', 'POST', validInput)).status, 401)
  assert.equal((await f.request('/api/admin/notes')).status, 401)
  f.setUser({ id: 7, role: 'USER' })
  assert.equal((await f.request('/api/admin/notes')).status, 403)
  assert.equal(
    (
      await f.request('/api/admin/notes/1/status', 'PATCH', {
        status: 'APPROVED',
      })
    ).status,
    403,
  )
  assert.equal(f.repository.notes.length, 0)
})

test('잘못된 입력은 DB에 저장하지 않고 400으로 응답한다', async (t) => {
  const f = await fixture(t)
  for (const change of [
    { title: '' },
    { title: 123 },
    { title: '가'.repeat(61) },
    { content: '가'.repeat(1001) },
    { tag: {} },
    { tag: '가'.repeat(21) },
    { observedDate: '2026-02-31' },
    { observedDate: '9999-12-31' },
    { latitude: null },
    { latitude: '' },
    { latitude: ' ' },
    { latitude: false },
    { longitude: 181 },
    { agreed: 'true' },
    { locationName: {} },
    { locationName: '가'.repeat(256) },
  ]) {
    const response = await f.request('/api/notes', 'POST', {
      ...validInput,
      ...change,
    })
    assert.equal(response.status, 400, JSON.stringify(change))
  }
  assert.equal((await f.request('/api/notes', 'POST', null)).status, 400)
  assert.equal(f.repository.notes.length, 0)
})

test('처리 충돌과 존재하지 않는 노트, 잘못된 상태·ID를 구분한다', async (t) => {
  const f = await fixture(t, { id: 8, role: 'ADMIN' })
  await f.request('/api/notes', 'POST', validInput)
  assert.equal(
    (
      await f.request('/api/admin/notes/1/status', 'PATCH', {
        status: 'APPROVED',
        expectedStatus: 'HIDDEN',
      })
    ).status,
    409,
  )
  assert.equal(
    (await f.request('/api/admin/notes/1/status', 'PATCH', { status: 'OTHER' }))
      .status,
    400,
  )
  assert.equal(
    (
      await f.request('/api/admin/notes/99/status', 'PATCH', {
        status: 'APPROVED',
      })
    ).status,
    404,
  )
  assert.equal((await f.request('/api/notes/1abc')).status, 400)
  assert.equal((await f.request('/api/admin/notes?status=OTHER')).status, 400)
  f.repository.setStatus = async () => false // SELECT 후 다른 관리자가 먼저 처리한 경우
  assert.equal(
    (
      await f.request('/api/admin/notes/1/status', 'PATCH', {
        status: 'APPROVED',
      })
    ).status,
    409,
  )
})

test('저장 실패 시 성공 응답이나 DB 오류 내용이 노출되지 않는다', async (t) => {
  const f = await fixture(t)
  f.repository.create = async () => {
    throw new Error('password=private SQL details')
  }
  const response = await f.request('/api/notes', 'POST', validInput)
  assert.equal(response.status, 500)
  assert.equal(JSON.stringify(response.body).includes('private'), false)
})
