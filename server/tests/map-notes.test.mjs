import assert from 'node:assert/strict'
import process from 'node:process'
import { once } from 'node:events'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../src/app.js'
import {
  memoryRepository,
  validInput,
  TEST_ADMIN_ID,
} from './support/notesFixture.mjs'

// 카카오 외부 SDK만 대체. React → fetch → 실제 Express API를 실행한다.
function installKakao() {
  class LatLng {
    constructor(lat, lng) {
      this.lat = lat
      this.lng = lng
    }
    getLat() {
      return this.lat
    }
    getLng() {
      return this.lng
    }
  }
  class Map {
    constructor() {
      this.level = 4
      this.listeners = {}
      window.testNoteMap = this
    }
    setDraggable() {}
    setZoomable() {}
    relayout() {}
    panTo() {}
    getLevel() {
      return this.level
    }
    setLevel(level) {
      this.level = level
      for (const handler of [...(this.listeners.zoom_changed ?? [])]) handler()
    }
  }
  window.kakao = {
    maps: {
      load: (done) => done(),
      Map,
      LatLng,
      CustomOverlay: class {
        constructor({ content, zIndex, position }) {
          this.element = content
          // 실제 SDK처럼 같은 좌표의 오버레이는 겹치고 zIndex로 클릭 대상이 정해진다.
          Object.assign(content.style, {
            position: 'absolute',
            left: '600px',
            top: '400px',
            zIndex: String(zIndex),
          })
          content.dataset.testOverlay = String(zIndex)
          content.dataset.latitude = String(position.lat)
          content.dataset.longitude = String(position.lng)
          document.body.append(content)
        }
        setMap(map) {
          if (!map) this.element.remove()
        }
      },
      Circle: class {
        setMap() {}
      },
      event: {
        addListener(map, name, handler) {
          ;(map.listeners[name] ??= []).push(handler)
        },
        removeListener(map, name, handler) {
          map.listeners[name] = (map.listeners[name] ?? []).filter(
            (fn) => fn !== handler,
          )
        },
      },
      services: { Geocoder: class {}, Places: class {} },
    },
  }
}

test('조회 버튼 없이 메인 지도에 승인 노트 표시, 마커 클릭으로 실제 내용 조회', async (t) => {
  const repository = memoryRepository()
  const allowedOrigins = []
  const api = createApp({
    repository,
    allowedOrigins,
    // 실제 로그인 대신 테스트 서버에서 프론트 세션 확인 응답만 제공한다.
    authRouter(req, res, next) {
      if (req.method === 'GET' && req.path === '/me') {
        return res.json({
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            role: 'ADMIN',
            nickname: '테스트 관리자',
          },
        })
      }
      next()
    },
    authenticate(req, res, next) {
      req.user = { id: '00000000-0000-4000-8000-000000000001', role: 'ADMIN' }
      next()
    },
  }).listen(0, '127.0.0.1')
  await once(api, 'listening')
  t.after(() => new Promise((resolve) => api.close(resolve)))
  const apiUrl = `http://127.0.0.1:${api.address().port}`
  const vite = await createServer({
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: { '/api': { target: apiUrl } },
    },
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': JSON.stringify('test-key'),
      'import.meta.env.VITE_WMS_ENABLED': JSON.stringify('false'),
    },
  })
  await vite.listen()
  t.after(() => vite.close())
  const baseUrl = vite.resolvedUrls.local[0]
  allowedOrigins.push(new URL(baseUrl).origin)
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  })
  t.after(() => browser.close())
  const page = await browser.newPage()
  page.setDefaultTimeout(5000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://dapi.kakao.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `(${installKakao})()`,
    }),
  )
  const send = async (path, method, body) => {
    const response = await fetch(apiUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    assert.equal(response.ok, true)
    return response.json()
  }
  await send('/api/notes', 'POST', validInput)
  await page.goto(baseUrl)
  const overlays = page.getByRole('button', {
    name: '보행로 관찰',
    exact: true,
  })
  await page.getByRole('button', { name: '내 위치로 이동' }).waitFor()
  assert.equal(await overlays.count(), 0)
  await send('/api/admin/notes/1/status', 'PATCH', {
    status: 'APPROVED',
    expectedStatus: 'PENDING',
  })
  const loaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/notes',
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await loaded
  await overlays.first().waitFor({ timeout: 5000 })
  assert.equal(await overlays.count(), 1)
  assert.equal(
    await overlays.first().locator('..').getAttribute('data-latitude'),
    '37.5665',
  )
  assert.equal(
    await overlays.first().locator('..').getAttribute('data-longitude'),
    '126.978',
  )
  // 100m 축척(4)에서 보이고 250m 축척(5)에서는 사라진 뒤 다시 표시된다.
  await page.evaluate(() => window.testNoteMap.setLevel(5))
  await overlays.first().waitFor({ state: 'detached' })
  await page
    .getByText('지도를 더 확대하면 안심노트가 보여요.', { exact: true })
    .waitFor()
  await page.evaluate(() => window.testNoteMap.setLevel(4))
  await overlays.first().waitFor()
  assert.equal(
    await page
      .getByText('지도를 더 확대하면 안심노트가 보여요.', { exact: true })
      .count(),
    0,
  )
  await page.evaluate(() => window.testNoteMap.setLevel(3))
  assert.equal(await overlays.count(), 1)
  await overlays.first().click()
  assert.equal(new URL(page.url()).pathname, '/')
  await page
    .getByRole('heading', { name: '보행로 관찰', exact: true })
    .waitFor()
  assert.equal(
    await page.getByText(validInput.content, { exact: true }).isVisible(),
    true,
  )
  assert.equal(
    await page.getByText('서울시 중구', { exact: true }).isVisible(),
    true,
  )
  await send('/api/admin/notes/1/status', 'PATCH', {
    status: 'HIDDEN',
    reason: '위치 재확인',
  })
  await page.goto(baseUrl)
  await page.getByRole('button', { name: '내 위치로 이동' }).waitFor()
  assert.equal(await overlays.count(), 0)
  assert.deepEqual(errors, [])
  // 두 테이블 구조에서 저장하는 최근 처리 사유를 관리자 상세에 표시한다.
  await page.goto(`${baseUrl}bimil`)
  await page.getByRole('button', { name: /^숨김/ }).click()
  await page.getByRole('button', { name: '보행로 관찰', exact: true }).click()
  await page.getByText('최근 처리 상태와 사유', { exact: true }).click()
  await page
    .getByRole('dialog')
    .getByText('위치 재확인', { exact: true })
    .waitFor()
  assert.deepEqual(errors, [])
})

test('관리자 화면의 서버 페이지·검색·마지막 사유·인증 안내와 모바일을 확인한다', async (t) => {
  const repository = memoryRepository()
  for (let i = 0; i < 25; i++) {
    await repository.create({
      ...validInput,
      authorId: TEST_ADMIN_ID,
      title: `검토 메모 ${i}`,
    })
  }
  let user = { id: TEST_ADMIN_ID, role: 'ADMIN' }
  const list = repository.listForAdmin.bind(repository)
  repository.listForAdmin = async (filters) => {
    if (filters.query === '늦은')
      await new Promise((resolve) => setTimeout(resolve, 800))
    return list(filters)
  }
  const allowedOrigins = []
  const api = createApp({
    repository,
    allowedOrigins,
    authRouter(req, res, next) {
      if (req.method === 'GET' && req.path === '/me') {
        return res.json({
          user: user && { ...user, nickname: '테스트 관리자' },
        })
      }
      next()
    },
    authenticate(req, res, next) {
      req.user = user
      next()
    },
  }).listen(0, '127.0.0.1')
  await once(api, 'listening')
  t.after(() => new Promise((resolve) => api.close(resolve)))
  const vite = await createServer({
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}` } },
    },
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': JSON.stringify('test-key'),
      'import.meta.env.VITE_WMS_ENABLED': JSON.stringify('false'),
    },
  })
  await vite.listen()
  t.after(() => vite.close())
  const baseUrl = vite.resolvedUrls.local[0]
  allowedOrigins.push(new URL(baseUrl).origin)
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  })
  t.after(() => browser.close())
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://dapi.kakao.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `(${installKakao})()`,
    }),
  )
  await page.goto(`${baseUrl}bimil`)
  await page.getByText('검색 결과 25건', { exact: true }).waitFor()
  assert.equal(await page.getByRole('row').count(), 11)
  assert.equal(
    await page.getByRole('button', { name: '처리 이력', exact: true }).count(),
    0,
  )
  assert.equal(await page.getByRole('button', { name: /예시 메모/ }).count(), 0)
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByText('2 / 3 페이지', { exact: true }).waitFor()
  await page.getByLabel('제목·본문 검색').fill('늦은')
  await page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get('query') === '늦은',
  )
  await page.getByLabel('제목·본문 검색').fill('검토 메모 24')
  await page.getByText('검색 결과 1건', { exact: true }).waitFor()
  await page.waitForTimeout(1000)
  assert.equal(
    await page.getByText('검색 결과 1건', { exact: true }).isVisible(),
    true,
  )
  await page.getByRole('button', { name: '검토 메모 24', exact: true }).click()
  await page.getByRole('button', { name: '반려', exact: true }).click()
  await page
    .getByLabel('처리 사유 · 반려·숨김 필수 / 최대 500자')
    .fill('위치 확인 필요')
  await page
    .getByRole('button', { name: '선택한 처리 확정', exact: true })
    .click()
  await page.getByText('검색 결과 0건', { exact: true }).waitFor()
  assert.equal(repository.notes[24].status, 'REJECTED')
  assert.equal(repository.notes[24].moderationReason, '위치 확인 필요')
  await page
    .getByRole('combobox', { name: /승인 상태/ })
    .selectOption('REJECTED')
  await page.getByText('검색 결과 1건', { exact: true }).waitFor()
  await page.getByRole('button', { name: '검토 메모 24', exact: true }).click()
  await page.getByText('최근 처리 상태와 사유', { exact: true }).click()
  await page
    .getByRole('dialog')
    .getByText('위치 확인 필요', { exact: true })
    .waitFor()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  )
  await page.screenshot({ path: '/tmp/ansim-admin-api-mobile.png' })
  user = null
  await page.getByRole('button', { name: '목록 새로고침', exact: true }).click()
  await page
    .getByRole('heading', { name: '관리자 인증이 필요합니다.', exact: true })
    .waitFor()
  assert.equal(await page.getByRole('table').count(), 0)
  user = { id: TEST_ADMIN_ID, role: 'USER' }
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await page
    .getByRole('heading', { name: '관리자 권한이 없습니다.', exact: true })
    .waitFor()
  await page.route('**/api/admin/notes?**', (route) => route.abort())
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await page
    .getByRole('heading', { name: '목록을 불러오지 못했습니다.', exact: true })
    .waitFor()
  assert.deepEqual(errors, [])
})
