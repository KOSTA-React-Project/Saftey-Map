import {
  summarizeCounts,
  compareMetrics,
} from '../../src/services/colorMetrics.js'
import { CRIME_TYPES } from '../../src/constants/crimeTypes.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'
import { chromium } from 'playwright'

// 외부 지도·API는 fixture. 실제 React 라우트/레이아웃/입력/모달을 확인한다.
function installMapFixture() {
  window.testMaps = []
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
  class FakeMap {
    constructor(node) {
      this.node = node
      this.events = {}
      window.testMaps.push(this)
      node.style.background =
        'repeating-linear-gradient(0deg,transparent 0 55px,white 55px 62px), repeating-linear-gradient(90deg,#e4eae2 0 65px,white 65px 72px)'
      node.dataset.testMap = 'true'
    }
    setDraggable() {}
    setZoomable() {}
    relayout() {}
    panTo() {}
    setCenter() {}
    getLevel() {
      return 4
    }
    setLevel() {}
  }
  window.testMapClick = (lat, lng) =>
    (window.testMaps[0]?.events.click || []).forEach((callback) =>
      callback({ latLng: new LatLng(lat, lng) }),
    )
  window.kakao = {
    maps: {
      load: (done) => done(),
      Map: FakeMap,
      LatLng,
      CustomOverlay: class {
        constructor({ map, content }) {
          this.node = content
          content.style.cssText = 'position:absolute;left:45%;top:35%;z-index:4'
          map.node.append(content)
        }
        setMap(map) {
          if (!map) this.node.remove()
        }
      },
      Circle: class {
        setMap() {}
      },
      event: {
        addListener(map, type, fn) {
          ;(map.events[type] ||= []).push(fn)
        },
        removeListener(map, type, fn) {
          map.events[type] = (map.events[type] || []).filter(
            (value) => value !== fn,
          )
        },
      },
      services: {
        Status: { OK: 'OK' },
        Places: class {},
        Geocoder: class {
          coord2Address(lng, lat, done) {
            done([{ address: { address_name: `테스트 주소 ${lat}` } }], 'OK')
          }
        },
      },
    },
  }
}

const note = {
  id: '1',
  title: '모바일 테스트 메모',
  content: '화면에서 읽을 수 있는 메모입니다.',
  tag: '조명 고장',
  observedDate: '2026-10-27',
  locationName: '서울 테스트 주소',
  latitude: 37.5,
  longitude: 127,
  authorName: '테스트회원',
  authorId: '00000000-0000-4000-8000-000000000001',
  createdAt: '2026-10-27T00:00:00Z',
  status: 'PENDING',
}
const noOverflow = async (page) =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    `horizontal overflow: ${page.url()}`,
  )

test('390px·태블릿·1440px: 패널/메뉴/입력/비교 모달/관리자 카드가 사용 가능하다', async (t) => {
  const vite = await createServer({
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': '"fixture"',
      'import.meta.env.VITE_WMS_ENABLED': JSON.stringify('false'),
    },
    server: { host: '127.0.0.1', port: 0 },
  })
  await vite.listen()
  t.after(() => vite.close())
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
  })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(installMapFixture)
  await page.route('https://dapi.kakao.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.kakao.maps.load = (done) => done()',
    }),
  )
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const url = new URL(route.request().url())
      let data = []
      if (url.pathname === '/api/auth/me')
        data = {
          user: { id: note.authorId, role: 'ADMIN', nickname: '모바일 테스트' },
        }
      else if (url.pathname === '/api/admin/notes')
        data = {
          items: [note],
          total: 1,
          page: 1,
          totalPages: 1,
          pageSize: 10,
          counts: { PENDING: 1, APPROVED: 0, REJECTED: 0, HIDDEN: 0 },
        }
      else if (url.pathname === '/api/public-data/crime-compare') {
        // 브라우저 레이아웃 검증용 HTTP fixture. 실제 원천 호출 검증과 구분한다.
        const conditions = route.request().postDataJSON()
        const metrics = summarizeCounts(Array(10).fill(1), 0, 0)
        const dataByType = {
          ...metrics,
          byCrimeType: Object.fromEntries(
            CRIME_TYPES.map(({ id }) => [id, metrics]),
          ),
        }
        data = {
          conditions,
          A: dataByType,
          B: dataByType,
          comparison: compareMetrics(metrics, metrics),
          synthetic: false,
          queriedAt: 'test-fixture',
          source: { period: '테스트 fixture' },
        }
      } else if (url.pathname === '/api/notes/1') data = note
      else if (url.pathname.includes('crime-legend'))
        data = {
          header: { resultCode: '00' },
          body: {
            items: {
              item: Array.from({ length: 10 }, (_, i) => ({
                LGD_NO: i + 1,
                IMAGE: '#e9c574',
              })),
            },
          },
        }
      return route.fulfill({ json: data })
    },
  )
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`
  await page.goto(origin)
  const expand = page.getByRole('button', { name: '펼치기 ∧' })
  await expand.waitFor().catch(async (error) => {
    throw new Error(
      `${error.message}\n${await page.locator('body').innerText()}\n${errors.join('\n')}`,
    )
  })
  await noOverflow(page)
  await page.screenshot({ path: '/tmp/ansim-responsive-map-collapsed.png' })
  await expand.click()
  assert.equal(
    await page
      .getByRole('button', { name: '접기 ∨' })
      .getAttribute('aria-expanded'),
    'true',
  )
  assert.equal(
    await page.getByRole('button', { name: '이 위치로 비교하기' }).isVisible(),
    true,
  )
  await page.screenshot({ path: '/tmp/ansim-responsive-map-expanded.png' })
  await page.getByRole('button', { name: '접기 ∨' }).click()
  await page.getByRole('button', { name: '계정 메뉴 열기' }).click()
  await page.getByRole('link', { name: '이용 안내' }).waitFor()
  await page.keyboard.press('Escape')
  assert.equal(
    await page
      .getByRole('button', { name: '계정 메뉴 열기' })
      .getAttribute('aria-expanded'),
    'false',
  )

  await page.getByRole('link', { name: '두 지역 비교', exact: true }).click()
  await page.waitForFunction(() => window.testMaps[0]?.events.click?.length > 1)
  await page.evaluate(() => {
    window.testMapClick(37.5, 127)
  })
  await page.getByText(/다음 지도 클릭은 B/).waitFor({ state: 'attached' })
  await page.evaluate(() => {
    window.testMapClick(37.6, 127.1)
  })
  await expand.click()
  const compare = page.getByRole('button', {
    name: '같은 조건으로 비교하기',
    exact: true,
  })
  await compare.waitFor()
  await page.screenshot({ path: '/tmp/ansim-responsive-setup.png' })
  await compare.click().catch(async (error) => {
    throw new Error(
      `${error.message}\n${await page.locator('aside').innerText()}`,
    )
  })
  await page.getByRole('dialog').waitFor()
  await noOverflow(page)
  const bounds = await page.getByRole('dialog').boundingBox()
  assert.equal(Math.round(bounds.width), 390)
  await page.getByRole('tab', { name: 'B 지역' }).click()
  assert.equal(
    await page.getByRole('region', { name: 'B 지역 비교 결과' }).isVisible(),
    true,
  )
  await page.screenshot({ path: '/tmp/ansim-responsive-compare.png' })
  await page.getByRole('button', { name: '지점·반경 다시 선택 / 닫기' }).click()

  for (const size of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1200, height: 900 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size)
    await noOverflow(page)
    if (size.width < 1200) {
      const toggle = page.getByRole('button', { name: /접기 ∨|펼치기 ∧/ })
      if ((await toggle.getAttribute('aria-expanded')) === 'false')
        await toggle.click()
      await compare.scrollIntoViewIfNeeded()
      assert.equal(await compare.isVisible(), true)
      const actionBox = await compare.boundingBox()
      const navBox = await page
        .getByRole('navigation', { name: '주요 화면' })
        .boundingBox()
      assert.ok(
        actionBox.y + actionBox.height <= navBox.y + 1,
        '비교 버튼이 하단 메뉴에 가려지지 않음',
      )
    } else {
      assert.equal(
        await page.getByRole('button', { name: '펼치기 ∧' }).isVisible(),
        false,
      )
      assert.equal(await compare.isVisible(), true)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of [
    '/login',
    '/signup',
    '/policy',
    '/notes',
    '/notes/1',
    '/notes/new',
  ]) {
    await page.goto(origin + path)
    await page.getByRole('navigation', { name: '주요 화면' }).waitFor()
    await noOverflow(page)
    if (path === '/notes/new') {
      await page.locator('input[name="title"]').fill('모바일 입력 확인')
      await page.getByRole('link', { name: '지도에서 위치 고르기 ↓' }).click()
      await page
        .getByRole('link', { name: '위치 선택 후 입력 폼으로 돌아가기 ↑' })
        .click()
      assert.equal(
        await page.locator('input[name="title"]').inputValue(),
        '모바일 입력 확인',
      )
    }
  }
  await page.goto(origin + '/bimil')
  await page.getByRole('button', { name: note.title, exact: true }).waitFor()
  await noOverflow(page)
  await page.screenshot({ path: '/tmp/ansim-responsive-admin-list.png' })
  await page.getByRole('button', { name: note.title, exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await noOverflow(page)
  await page.screenshot({ path: '/tmp/ansim-responsive-admin.png' })
  assert.deepEqual(errors, [])
})
