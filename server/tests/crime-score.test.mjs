import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { PNG } from 'pngjs'
import { createApp } from '../src/app.js'
import { validPoint } from '../src/routes/crimeScore.js'

// 지도 탐색 한 지점 분석 API — 실제 키·네트워크 없이 가짜 범례와 PNG로 확인
const colors = [
  '#ffffb2',
  '#fee88b',
  '#fed165',
  '#fdb751',
  '#fd9b43',
  '#fa7a35',
  '#f45629',
  '#ea3420',
  '#d31a23',
  '#bd0026',
]
const settings = {
  serviceKey: 'test-secret',
  enabled: true,
  verified: true,
  palette: colors.join(','),
  period: '테스트 전용 기간',
}
const body = { point: { lat: 37.5, lng: 127 }, radius: 500 }

const rgb = (color) =>
  color
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16))
function png(size, rgba) {
  const image = new PNG({ width: size, height: size })
  for (let i = 0; i < size * size; i++) image.data.set(rgba, i * 4)
  return PNG.sync.write(image)
}
const legend = (list = colors) =>
  Response.json({
    header: { resultCode: '00' },
    body: {
      items: {
        item: list.map((color, i) => ({ LGD_NO: i + 1, IMAGE: color })),
      },
    },
  })
// 모든 원본 이미지를 한 가지 색으로 채운 가짜 공공지도
function fakeSafemap({ color = colors[9], legendColors = colors } = {}) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url.pathname)
    if (url.pathname.endsWith('/lgdInfo')) return legend(legendColors)
    const size = Number(url.searchParams.get('width'))
    return new Response(png(size, [...rgb(color), 255]), {
      headers: { 'content-type': 'image/png' },
    })
  }
  return { calls, fetchImpl }
}

async function api(t, options) {
  const server = createApp({ compareOptions: options }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return (payload) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/public-data/crime-score`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
}

test('국내 좌표와 반경 500m·1km만 받는다', () => {
  assert.equal(validPoint(body), true)
  assert.equal(validPoint({ ...body, radius: 1000 }), true)
  assert.equal(validPoint({ ...body, radius: 300 }), false)
  assert.equal(validPoint({ point: { lat: 10, lng: 127 }, radius: 500 }), false)
  assert.equal(
    validPoint({ point: { lat: '37.5', lng: 127 }, radius: 500 }),
    false,
  )
  assert.equal(validPoint({ radius: 500 }), false)
})

test('잘못된 입력은 400, 분석 설정이 꺼져 있으면 503으로 거절한다', async (t) => {
  const { calls, fetchImpl } = fakeSafemap()
  const off = await api(t, { ...settings, enabled: false, fetchImpl })
  assert.equal((await off({ ...body, radius: 300 })).status, 400)
  const response = await off(body)
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'ANALYSIS_NOT_VERIFIED')
  assert.deepEqual(calls, [], '설정이 꺼져 있으면 공공지도를 호출하지 않음')
})

test('한 지점의 전체·유형별 점수를 비교 분석과 같은 모양으로 돌려준다', async (t) => {
  const { calls, fetchImpl } = fakeSafemap({ color: colors[9] })
  const score = await api(t, { ...settings, fetchImpl })
  const response = await score({
    ...body,
    address: '입력 주소는 돌려주지 않음',
  })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.synthetic, false)
  assert.deepEqual(data.conditions, { radius: 500, point: body.point })
  assert.equal(data.result.status, 'OK')
  assert.equal(data.result.score, 100)
  assert.equal(data.result.distribution[9], 100)
  assert.equal(Object.keys(data.result.byCrimeType).length, 6)
  assert.equal(data.result.byCrimeType.THEFT.score, 100)
  assert.equal(data.result.geometry.size, 512)
  assert.equal(data.source.period, settings.period)
  assert.equal(calls.length, 7, '범례 1번 + 유형별 이미지 6장')
  assert.doesNotMatch(JSON.stringify(data), /test-secret|입력 주소/)
})

test('실제 범례가 설정한 10색과 다르면 점수를 만들지 않는다', async (t) => {
  const { fetchImpl } = fakeSafemap({
    legendColors: [...colors.slice(0, 9), '#000000'],
  })
  const score = await api(t, { ...settings, fetchImpl })
  const response = await score(body)
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'ANALYSIS_FAILED')
})
