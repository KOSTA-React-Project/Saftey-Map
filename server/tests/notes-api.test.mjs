import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { createMysqlNotes } from '../src/notes/mysqlRepository.js'
import {
  memoryRepository,
  validInput,
  TEST_USER_ID,
  TEST_ADMIN_ID,
} from './support/notesFixture.mjs'

// 회원 ID는 UUID (노션 DB ERD)
const USER_ID = '00000000-0000-4000-8000-000000000007'
const ADMIN_ID = '00000000-0000-4000-8000-000000000008'

// 외부 DB 경계만 대체한다. 실제 라우트·인증 검사·검증·응답은 HTTP로 실행한다.
async function fixture(t, initialUser = { id: USER_ID, role: 'USER' }) {
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
  assert.deepEqual(created.body, { id: '1', status: 'PENDING' })
  assert.equal(f.repository.notes[0].authorId, USER_ID)
  assert.equal(f.repository.notes[0].latitude, 37.5665)
  assert.equal(f.repository.notes[0].longitude, 126.978)
  f.setUser(null)
  assert.deepEqual((await f.request('/api/notes')).body, [])
  assert.equal((await f.request('/api/notes/1')).status, 404)
  f.setUser({ id: ADMIN_ID, role: 'ADMIN' })
  assert.equal((await f.request('/api/admin/notes')).body.items.length, 1)
  const approved = await f.request('/api/admin/notes/1/status', 'PATCH', {
    status: 'APPROVED',
    expectedStatus: 'PENDING',
    reason: '확인 완료',
  })
  assert.equal(approved.status, 200)
  f.setUser(null)
  assert.deepEqual((await f.request('/api/notes')).body, [
    {
      id: '1',
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
  const f = await fixture(t, { id: ADMIN_ID, role: 'ADMIN' })
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
  const admin = (await f.request('/api/admin/notes?status=REJECTED')).body.items
  assert.equal(admin[0].moderationReason, '위치 확인 필요')
})

test('미인증 작성·관리자 조회를 거절하고 일반 회원의 승인도 거절한다', async (t) => {
  const f = await fixture(t, null)
  assert.equal((await f.request('/api/notes', 'POST', validInput)).status, 401)
  assert.equal((await f.request('/api/admin/notes')).status, 401)
  f.setUser({ id: USER_ID, role: 'USER' })
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
  const f = await fixture(t, { id: ADMIN_ID, role: 'ADMIN' })
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

test('관리자 목록은 서버에서 검색·상태·태그·페이지를 적용하고 전체 상태 개수를 구분한다', async (t) => {
  const f = await fixture(t, { id: TEST_ADMIN_ID, role: 'ADMIN' })
  for (let i = 0; i < 23; i++) {
    await f.repository.create({
      ...validInput,
      authorId: TEST_USER_ID,
      title: `메모 ${i}`,
      tag: i % 2 ? '조명 고장' : '공사 구간',
    })
  }
  f.repository.notes[0].status = 'APPROVED'
  const first = (await f.request('/api/admin/notes')).body
  assert.equal(first.items.length, 10)
  assert.equal(first.total, 22)
  assert.equal(first.totalPages, 3)
  assert.deepEqual(first.counts, {
    PENDING: 22,
    APPROVED: 1,
    REJECTED: 0,
    HIDDEN: 0,
  })
  const second = (await f.request('/api/admin/notes?page=2')).body
  assert.equal(second.page, 2)
  assert.equal(second.items.length, 10)
  assert.equal(
    first.items.some((a) => second.items.some((b) => a.id === b.id)),
    false,
  )
  const last = (await f.request('/api/admin/notes?page=999')).body
  assert.equal(last.page, 3)
  assert.equal(last.items.length, 2)
  const params = new URLSearchParams({
    status: '',
    query: '메모 1',
    tag: '조명 고장',
    pageSize: '2',
  })
  const filtered = (await f.request(`/api/admin/notes?${params}`)).body
  assert.equal(filtered.total, 6)
  assert.equal(filtered.items.length, 2)
  assert.ok(
    filtered.items.every(
      (n) => n.tag === '조명 고장' && n.title.includes('메모 1'),
    ),
  )
  assert.equal(
    (await f.request('/api/admin/notes?query=NOT_FOUND')).body.total,
    0,
  )
})

test('관리자 목록의 과도한 조회 개수·검색어·중복 파라미터를 DB 조회 전에 거절한다', async (t) => {
  const f = await fixture(t, { id: TEST_ADMIN_ID, role: 'ADMIN' })
  f.repository.listForAdmin = () => {
    throw new Error('이 입력으로는 DB를 호출하면 안 됩니다.')
  }
  for (const query of [
    'page=0',
    'page=-1',
    'page=1.5',
    'page=100001',
    'pageSize=0',
    'pageSize=51',
    'page=1&page=2',
    'status=PENDING&status=APPROVED',
    'query=a&query=b',
    `query=${'x'.repeat(81)}`,
    `tag=${'x'.repeat(21)}`,
  ]) {
    assert.equal(
      (await f.request(`/api/admin/notes?${query}`)).status,
      400,
      query,
    )
  }
})

test('회원 UUID와 BIGINT 메모 번호를 유지하고 마지막 처리 사유만 덮어쓴다', async (t) => {
  const f = await fixture(t, { id: TEST_ADMIN_ID, role: 'ADMIN' })
  await f.repository.create({ ...validInput, authorId: TEST_USER_ID })
  f.repository.notes[0].id = '18446744073709551615'
  const path = '/api/admin/notes/18446744073709551615/status'
  assert.equal(
    (
      await f.request(path, 'PATCH', {
        status: 'APPROVED',
        expectedStatus: 'PENDING',
      })
    ).status,
    200,
  )
  assert.equal(f.repository.notes[0].moderationReason, '')
  assert.equal(
    (
      await f.request(path, 'PATCH', {
        status: 'HIDDEN',
        reason: '위치 재확인',
        expectedStatus: 'APPROVED',
      })
    ).status,
    200,
  )
  assert.equal(f.repository.notes[0].moderationReason, '위치 재확인')
  assert.equal(
    (
      await f.request(path, 'PATCH', {
        status: 'APPROVED',
        reason: '확인 완료',
        expectedStatus: 'HIDDEN',
      })
    ).status,
    200,
  )
  assert.equal(f.repository.notes[0].moderationReason, '확인 완료')
  const detail = (await f.request('/api/notes/18446744073709551615')).body
  assert.equal(detail.id, '18446744073709551615')
  assert.equal(detail.moderationReason, undefined)
  assert.equal((await f.request('/api/notes/18446744073709551616')).status, 400)
  f.setUser({ id: 7, role: 'ADMIN' })
  assert.equal((await f.request('/api/admin/notes')).status, 401)
})

test('MySQL 목록 SQL은 검색값을 바인딩하고 LIMIT/OFFSET으로 조회량을 제한한다', async () => {
  const calls = []
  const pool = {
    async execute(sql, values = []) {
      calls.push({ sql, values })
      if (sql.includes('GROUP BY'))
        return [[{ status: 'PENDING', count: '25' }]]
      return [[{ total: '25' }]]
    },
    async query(sql, values) {
      calls.push({ sql, values })
      return [[]]
    },
  }
  const keyword = "%' OR 1=1 --"
  const result = await createMysqlNotes(pool).listForAdmin({
    status: 'PENDING',
    query: keyword,
    tag: '조명 고장',
    page: 2,
    pageSize: 10,
  })
  const select = calls.find((call) => call.sql.includes('LIMIT'))
  assert.match(
    select.sql,
    /ORDER BY created_at DESC, id DESC LIMIT \? OFFSET \?/,
  )
  assert.equal(select.sql.includes(keyword), false)
  assert.deepEqual(select.values, [
    'PENDING',
    '조명 고장',
    keyword,
    keyword,
    10,
    10,
  ])
  assert.equal(result.total, 25)
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 3)
  assert.equal(result.counts.PENDING, 25)
})
