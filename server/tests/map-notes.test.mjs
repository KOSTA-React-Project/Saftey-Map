import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../app.mjs'
import { memoryRepository, validInput } from './support/notesFixture.mjs'

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
    setDraggable() {}
    setZoomable() {}
    relayout() {}
    panTo() {}
    getLevel() {
      return 4
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
        Object.assign(content.style, { position: 'absolute', left: '600px', top: '400px', zIndex: String(zIndex) })
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
      event: { addListener() {}, removeListener() {} },
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
    authenticate(req, res, next) {
      req.user = { id: 1, role: 'ADMIN' }
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
      'import.meta.env.VITE_SAFEMAP_KEY': JSON.stringify(''),
    },
  })
  await vite.listen()
  t.after(() => vite.close())
  const baseUrl = vite.resolvedUrls.local[0]
  allowedOrigins.push(new URL(baseUrl).origin)
  const browser = await chromium.launch()
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
  const overlays = page.getByRole('button', { name: '보행로 관찰', exact: true })
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
  assert.equal(await overlays.first().locator('..').getAttribute('data-latitude'), '37.5665')
  assert.equal(await overlays.first().locator('..').getAttribute('data-longitude'), '126.978')
  await overlays.first().click()
  await page.waitForURL('**/notes/1')
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
