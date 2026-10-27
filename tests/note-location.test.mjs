import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { createServer } from 'vite'

let server
let browser
let baseUrl

before(async () => {
  server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': JSON.stringify('test-key'),
    },
  })
  await server.listen()
  baseUrl = server.resolvedUrls.local[0]
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  await server?.close()
})

// 외부 카카오 SDK만 대체하고, 실제 React 화면·검색·주소 변환·저장 코드를 실행한다.
// 콜백을 보관해 느린 응답과 응답 순서 역전을 시간 지연 없이 재현한다.
function installKakao() {
  const pending = { addresses: {}, places: {}, reverse: [] }
  const listeners = new WeakMap()
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
      window.testMap = this
    }
    setDraggable() {}
    setZoomable() {}
    relayout() {}
    panTo() {}
  }
  window.kakao = {
    maps: {
      load: (done) => done(),
      Map,
      LatLng,
      CustomOverlay: class {
        setMap() {}
      },
      event: {
        addListener(target, name, callback) {
          listeners.set(target, callback)
        },
        removeListener(target) {
          listeners.delete(target)
        },
      },
      services: {
        Status: { OK: 'OK' },
        Geocoder: class {
          addressSearch(query, done) {
            pending.addresses[query] = done
          }
          coord2Address(lng, lat, done) {
            pending.reverse.push({ lat, lng, done })
          }
        },
        Places: class {
          keywordSearch(query, done) {
            pending.places[query] = done
          }
        },
      },
    },
  }
  window.locationTest = {
    pending,
    clickMap(lat, lng) {
      listeners.get(window.testMap)({ latLng: new LatLng(lat, lng) })
    },
    searchResult(query) {
      pending.addresses[query]([], 'OK')
      pending.places[query](
        [
          {
            place_name: query,
            road_address_name: `${query} 주소`,
            address_name: `${query} 지번`,
            y: '37.5',
            x: '127',
          },
        ],
        'OK',
      )
    },
    addressResult(index, address) {
      pending.reverse[index].done(
        address ? [{ road_address: { address_name: address } }] : [],
        address ? 'OK' : 'ZERO_RESULT',
      )
    },
  }
}

async function withPage(run) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // 위치 선택 테스트에서는 HTTP 경계만 대체한다. localStorage는 테스트 관찰용이다.
  await page.route('**/api/notes', async (route) => {
    if (route.request().method() === 'POST') {
      const note = route.request().postDataJSON()
      await page.evaluate((value) => localStorage.setItem('safety-map:notes', JSON.stringify([{ ...value, status: 'PENDING' }])), note)
      return route.fulfill({ status: 201, json: { id: 1, status: 'PENDING' } })
    }
    return route.fulfill({ json: [] })
  })
  await page.route('https://dapi.kakao.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `(${installKakao})()`,
    }),
  )
  try {
    await page.goto(`${baseUrl}notes/new`)
    await page.waitForFunction(() => window.testMap)
    await run(page)
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
}

const queryInput = (page) =>
  page.getByRole('textbox', { name: '주소 또는 장소 검색' })
const searchButton = (page) =>
  page.getByRole('button', { name: '검색', exact: true })
const submitButton = (page) =>
  page.getByRole('button', { name: '공개 안심노트 등록' })

test('IME 확정 Enter(keyCode 229)는 검색하지 않고 다음 일반 Enter만 검색한다', () =>
  withPage(async (page) => {
    await queryInput(page).fill('강남역')
    await queryInput(page).dispatchEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 229,
      isComposing: false,
    })
    assert.equal(
      await page.evaluate(() =>
        Boolean(window.locationTest.pending.places['강남역']),
      ),
      false,
    )
    assert.equal(await queryInput(page).inputValue(), '강남역')
    await queryInput(page).press('Enter')
    await page.waitForFunction(() =>
      Boolean(window.locationTest.pending.places['강남역']),
    )
    assert.equal(await searchButton(page).isDisabled(), true)
  }))

test('검색 결과 주소가 공백이면 역지오코딩 완료 전 제출을 막는다', () =>
  withPage(async (page) => {
    await fillForm(page)
    await search(page, '주소 없는 장소')
    await page.evaluate(() => {
      const pending = window.locationTest.pending
      pending.addresses['주소 없는 장소']([], 'OK')
      pending.places['주소 없는 장소'](
        [
          {
            place_name: '주소 없는 장소',
            road_address_name: '   ',
            address_name: '',
            y: '37.5',
            x: '127',
          },
        ],
        'OK',
      )
    })
    await page.waitForFunction(
      () => window.locationTest.pending.reverse.length === 1,
    )
    // SDK 콜백 실행과 React의 화면 반영은 별도 단계다.
    await page.locator('button[type="submit"]:disabled').waitFor()
    assert.equal(await submitButton(page).isDisabled(), true)
    await page.locator('form').evaluate((form) => form.requestSubmit())
    assert.equal(
      await page.evaluate(() => localStorage.getItem('safety-map:notes')),
      null,
    )
    await page.evaluate(() => window.locationTest.addressResult(0, '   '))
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]').disabled,
    )
    await submitButton(page).click()
    await page
      .getByRole('heading', { name: '안심노트가 제출되었어요' })
      .waitFor()
    const notes = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('safety-map:notes')),
    )
    assert.equal(notes[0].locationName, '주소를 확인할 수 없는 위치')
  }))

async function search(page, query) {
  await queryInput(page).fill(query)
  await queryInput(page).press('Enter')
  await page.waitForFunction(
    (q) => Boolean(window.locationTest.pending.places[q]),
    query,
  )
}

async function fillForm(page) {
  await page.getByRole('textbox', { name: '제목' }).fill('보행로 관찰')
  await page.getByRole('textbox', { name: '태그' }).fill('보행로')
  await page.locator('input[name="observedDate"]').fill('2026-01-01')
  await page
    .getByRole('textbox', { name: '내용' })
    .fill('보행로 조명을 확인했습니다.')
  await page.getByRole('checkbox').check()
}

test('입력 변경 후 즉시 재검색하고 오래된 응답은 새 검색 상태를 바꾸지 않는다', () =>
  withPage(async (page) => {
    await search(page, 'A')
    await queryInput(page).fill('B')
    assert.equal(await searchButton(page).isEnabled(), true)
    await queryInput(page).press('Enter')
    await page.waitForFunction(() =>
      Boolean(window.locationTest.pending.places.B),
    )
    await page.evaluate(() => window.locationTest.searchResult('A'))
    assert.equal(await searchButton(page).isDisabled(), true)
    assert.equal(await queryInput(page).inputValue(), 'B')
    await page.evaluate(() => window.locationTest.searchResult('B'))
    await page.waitForFunction(
      () => window.locationTest.pending.reverse.length === 1,
    )
    await page.evaluate(() =>
      window.locationTest.addressResult(0, 'B 확정 주소'),
    )
    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[placeholder="주소나 장소명을 입력하세요"]',
        ).value === 'B 확정 주소',
    )
  }))

test('지도 클릭 뒤 도착한 검색 응답은 지도 선택을 덮어쓰지 않는다', () =>
  withPage(async (page) => {
    await search(page, 'A')
    await page.evaluate(() => window.locationTest.clickMap(37.6, 127.1))
    await page.evaluate(() =>
      window.locationTest.addressResult(0, '지도 선택 주소'),
    )
    await page.evaluate(() => window.locationTest.searchResult('A'))
    await page.waitForFunction(
      () =>
        document.querySelector(
          'input[placeholder="주소나 장소명을 입력하세요"]',
        ).value === '지도 선택 주소',
    )
    assert.equal(await queryInput(page).inputValue(), '지도 선택 주소')
    assert.equal(await searchButton(page).isEnabled(), true)
  }))

test('주소 확인 중에는 버튼과 폼 제출 모두 저장을 막고 완료 후 주소를 저장한다', () =>
  withPage(async (page) => {
    await fillForm(page)
    await page.evaluate(() => window.locationTest.clickMap(37.6, 127.1))
    await page.locator('button[type="submit"]:disabled').waitFor()
    assert.equal(await submitButton(page).isDisabled(), true)
    await page.locator('form').evaluate((form) => form.requestSubmit())
    assert.equal(
      await page.evaluate(() => localStorage.getItem('safety-map:notes')),
      null,
    )
    await page.evaluate(() =>
      window.locationTest.addressResult(0, '지도 선택 주소'),
    )
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]').disabled,
    )
    await submitButton(page).click()
    await page
      .getByRole('heading', { name: '안심노트가 제출되었어요' })
      .waitFor()
    const notes = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('safety-map:notes')),
    )
    assert.equal(notes[0].locationName, '지도 선택 주소')
    assert.equal(notes[0].latitude, 37.6)
    assert.equal(notes[0].status, 'PENDING')
  }))

test('검색 결과 주소는 역지오코딩 대기 중에도 바로 저장할 수 있다', () =>
  withPage(async (page) => {
    await fillForm(page)
    await search(page, 'B')
    await page.evaluate(() => window.locationTest.searchResult('B'))
    await page.waitForFunction(
      () => window.locationTest.pending.reverse.length === 1,
    )
    await submitButton(page).click()
    await page
      .getByRole('heading', { name: '안심노트가 제출되었어요' })
      .waitFor()
    const notes = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('safety-map:notes')),
    )
    assert.equal(notes[0].locationName, 'B 주소')
  }))

test('이전 검색의 실패도 새 검색의 로딩 상태와 입력을 바꾸지 않는다', () =>
  withPage(async (page) => {
    await search(page, 'A')
    await search(page, 'B')
    await page.evaluate(() => {
      window.locationTest.pending.addresses.A([], 'OK')
      // 외부 응답 변환 중 발생한 오류를 늦게 도착하게 한다.
      window.locationTest.pending.places.A([null], 'OK')
    })
    assert.equal(await searchButton(page).isDisabled(), true)
    assert.equal(await queryInput(page).inputValue(), 'B')
    await page.evaluate(() => window.locationTest.searchResult('B'))
    await page.waitForFunction(
      () => window.locationTest.pending.reverse.length === 1,
    )
    await searchButton(page).and(page.locator(':enabled')).waitFor()
    assert.equal(await searchButton(page).isEnabled(), true)
  }))

test('위치 입력 수정 시 이전 좌표와 늦은 주소 응답을 무효화한다', () =>
  withPage(async (page) => {
    await fillForm(page)
    await page.evaluate(() => window.locationTest.clickMap(37.6, 127.1))
    await queryInput(page).fill('새 위치')
    await page.evaluate(() => window.locationTest.addressResult(0, '이전 주소'))
    await submitButton(page).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await queryInput(page).inputValue(), '새 위치')
    assert.equal(
      await page.evaluate(() => localStorage.getItem('safety-map:notes')),
      null,
    )
  }))

test('주소 조회 실패 후에는 확인 불가 안내와 좌표를 함께 저장한다', () =>
  withPage(async (page) => {
    await fillForm(page)
    await page.evaluate(() => window.locationTest.clickMap(37.6, 127.1))
    await page.evaluate(() => window.locationTest.addressResult(0, null))
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]').disabled,
    )
    await submitButton(page).click()
    await page
      .getByRole('heading', { name: '안심노트가 제출되었어요' })
      .waitFor()
    const notes = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('safety-map:notes')),
    )
    assert.equal(notes[0].locationName, '주소를 확인할 수 없는 위치')
    assert.equal(notes[0].latitude, 37.6)
  }))
