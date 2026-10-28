import {
  REVIEWED_COLORS,
  REVIEWED_COLORS_VERSION,
} from '../src/crime/reviewedColors.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { once, EventEmitter } from 'node:events'
import { PNG } from 'pngjs'
import { createApp } from '../src/app.js'
import {
  countPixels,
  createPixelClassifier,
  radiusMask,
  geometryFor,
  distanceMeters,
} from '../src/crime/analyze.js'

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
const palette = colors.map((color, i) => ({ grade: i + 1, color }))
const conditions = {
  A: { lat: 37.5, lng: 127 },
  B: { lat: 37.6, lng: 127.1 },
  radius: 500,
}
const settings = {
  serviceKey: 'test-secret',
  enabled: true,
  verified: true,
  palette: colors.join(','),
  period: '테스트 전용 기간',
}
function png(size, pixels) {
  const image = new PNG({ width: size, height: size })
  for (let i = 0; i < size * size; i++)
    image.data.set(pixels[i % pixels.length], i * 4)
  return PNG.sync.write(image)
}
const rgb = (color) =>
  color
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16))
const legend = () =>
  Response.json({
    header: { resultCode: '00' },
    body: {
      items: {
        item: palette.map((item) => ({
          LGD_NO: item.grade,
          IMAGE: item.color,
        })),
      },
    },
  })
async function api(t, options) {
  const server = createApp({ compareOptions: options }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return (body, options = {}) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/public-data/crime-compare`,
      {
        ...options,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
}

test('제한된 근접색을 분류하고 낮은 alpha·애매한 색은 U, alpha=0만 E로 센다', () => {
  const pixels = [
    [...rgb(colors[0]), 255],
    [...rgb(colors[9]), 255],
    [...rgb(colors[0]), 95],
    [255, 255, 255, 255],
  ]
  const result = countPixels(
    png(2, pixels),
    2,
    new Uint8Array([1, 1, 1, 1]),
    palette,
  )
  assert.equal(result.valid, 2)
  assert.equal(result.unclassified, 2)
  assert.equal(result.score, 50)
  const empty = countPixels(
    png(2, [[0, 0, 0, 0]]),
    2,
    new Uint8Array([1, 1, 1, 1]),
    palette,
  )
  assert.equal(empty.status, 'NO_DATA')
  assert.equal(empty.score, null)
  assert.equal(empty.unpainted, 4)
  const masked = countPixels(
    png(2, pixels),
    2,
    new Uint8Array([1, 0, 0, 0]),
    palette,
  )
  assert.equal(masked.total, 1)
  assert.equal(masked.score, 0)
  const corrupt = png(2, pixels)
  corrupt[corrupt.length - 1] ^= 1
  assert.throws(() => countPixels(corrupt, 2, new Uint8Array(4), palette))
})

test('경도/위도 순서, 북쪽 첫 행, 픽셀 중심의 구면 반경 마스크와 해상도를 유지한다', () => {
  for (const radius of [500, 1000]) {
    const point = conditions.A
    const geometry = geometryFor(point, radius)
    const mask = radiusMask(point, radius, geometry)
    const { size, bbox } = geometry
    assert.equal(size, radius === 500 ? 512 : 1024)
    assert.ok(
      bbox[0] < point.lng &&
        bbox[1] < point.lat &&
        bbox[2] > point.lng &&
        bbox[3] > point.lat,
    )
    assert.equal(mask[0], 0)
    assert.equal(mask[Math.floor(size / 2) * size + Math.floor(size / 2)], 1)
    assert.ok(
      Math.abs(
        mask.reduce((sum, x) => sum + x, 0) / (size * size) - Math.PI / 4,
      ) < 0.02,
    )
    const b = geometryFor(conditions.B, radius)
    assert.ok(
      Math.abs(
        distanceMeters(
          { lat: point.lat, lng: bbox[0] },
          { lat: point.lat, lng: bbox[2] },
        ) -
          distanceMeters(
            { lat: conditions.B.lat, lng: b.bbox[0] },
            { lat: conditions.B.lat, lng: b.bbox[2] },
          ),
      ) < 0.01,
    )
  }
})

test('검증/설정 미완료·잘못된 좌표는 실제 원천을 호출하지 않는다', async (t) => {
  let calls = 0
  const request = await api(t, {
    ...settings,
    verified: false,
    fetchImpl: async () => {
      calls++
      throw new Error()
    },
  })
  assert.equal((await request(conditions)).status, 503)
  assert.equal((await request({ ...conditions, radius: 250 })).status, 400)
  assert.equal(
    (await request({ ...conditions, A: { lat: '37.5', lng: 127 } })).status,
    400,
  )
  assert.equal(
    (await request({ ...conditions, A: { lat: 0, lng: 0 } })).status,
    400,
  )
  assert.equal(calls, 0)
})

test('원본 6유형×A/B를 독립 집계하고 동일 조건·출처·실제 모드로 응답한다', async (t) => {
  const calls = []
  const low = png(512, [[...rgb(colors[0]), 255]])
  const high = png(512, [[...rgb(colors[9]), 255]])
  const request = await api(t, {
    ...settings,
    fetchImpl: async (url) => {
      assert.equal(url.origin, 'https://www.safemap.go.kr')
      if (url.pathname.endsWith('lgdInfo')) return legend()
      assert.equal(url.searchParams.get('srs'), 'EPSG:4326')
      assert.equal(url.searchParams.get('version'), '1.1.1')
      assert.equal(url.searchParams.get('serviceKey'), 'test-secret')
      calls.push(url.searchParams.get('styles'))
      return new Response(calls.length <= 6 ? low : high, {
        headers: { 'content-type': 'image/png' },
      })
    },
  })
  const response = await request({
    ...conditions,
    A: { ...conditions.A, address: '응답에서 제외' },
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.synthetic, false)
  assert.deepEqual(result.conditions, conditions)
  assert.equal(result.A.score, 0)
  assert.equal(result.B.score, 100)
  assert.equal(result.comparison.scoreDifference, -100)
  assert.equal(calls.length, 12)
  assert.equal(new Set(calls).size, 6)
  assert.equal(Object.keys(result.A.byCrimeType).length, 6)
  assert.equal(JSON.stringify(result).includes('test-secret'), false)
  assert.equal(result.source.period, settings.period)
})

test('범례 변경·중복색·HTTP200 XML·잘못된 PNG는 가상 점수 없이 실패한다', async (t) => {
  for (const failure of ['changed', 'duplicate', 'xml', 'png']) {
    const request = await api(t, {
      ...settings,
      fetchImpl: async (url) => {
        if (url.pathname.endsWith('lgdInfo')) {
          if (failure === 'changed' || failure === 'duplicate') {
            const raw = await legend().json()
            raw.body.items.item[0].IMAGE =
              failure === 'changed' ? '#ffffff' : colors[1]
            return Response.json(raw)
          }
          return legend()
        }
        return new Response('test-secret', {
          headers: {
            'content-type': failure === 'xml' ? 'text/xml' : 'image/png',
          },
        })
      },
    })
    const response = await request(conditions)
    assert.equal(response.status, 502)
    const body = await response.json()
    assert.equal(body.code, 'ANALYSIS_FAILED')
    assert.equal(body.A, undefined)
    assert.equal(JSON.stringify(body).includes('test-secret'), false)
  }
})

test('동시 비교를 제한하고 클라이언트 취소를 원천 요청까지 전달한다', async (t) => {
  const events = new EventEmitter()
  const request = await api(t, {
    ...settings,
    fetchImpl: async (url, { signal }) => {
      if (url.pathname.endsWith('lgdInfo')) return legend()
      events.emit('image')
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            events.emit('aborted')
            reject(signal.reason)
          },
          { once: true },
        )
      })
    },
  })
  const controller = new AbortController()
  const started = once(events, 'image')
  const first = request(conditions, { signal: controller.signal })
  await started
  const second = await request(conditions)
  assert.equal(second.status, 503)
  assert.equal((await second.json()).code, 'ANALYSIS_BUSY')
  const aborted = once(events, 'aborted')
  controller.abort()
  await assert.rejects(first, { name: 'AbortError' })
  await aborted
})

test('실제 원본의 alpha153·작은 양자화 차이는 분류하고 중간색·먼 색상은 버린다', () => {
  const actualPalette = [
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
  ].map((color, index) => ({ grade: index + 1, color }))
  const result = countPixels(
    png(2, [
      [253, 232, 138, 153],
      [253, 208, 102, 153],
      [254, 244, 159, 153],
      [0, 0, 255, 255],
    ]),
    2,
    new Uint8Array([1, 1, 1, 1]),
    actualPalette,
  )
  assert.equal(result.counts[1], 1)
  assert.equal(result.counts[2], 1)
  assert.equal(result.unclassified, 2)
})

test('투명도96·색상거리8·등급간격6 경계와 미분류 사유의 합을 검증한다', () => {
  const classify = createPixelClassifier(palette)
  assert.equal(classify(253, 155, 67, 95).reason, 'lowAlpha')
  assert.equal(classify(253, 155, 67, 96).grade, 5)
  assert.equal(classify(245, 155, 67, 153).grade, 5)
  assert.equal(classify(244, 155, 67, 153).reason, 'distance')
  const close = [0, 10].map((red, index) => ({
    grade: index + 1,
    color: `#${red.toString(16).padStart(2, '0')}0000`,
  }))
  for (let i = 0; i < 8; i++)
    close.push({
      grade: i + 3,
      color: `#${(30 + i * 20).toString(16).padStart(2, '0')}6464`,
    })
  const match = createPixelClassifier(close)
  assert.equal(match(2, 0, 0, 153).reason, 'ambiguous')
  assert.equal(match(1, 0, 0, 153).grade, 1)
  const result = countPixels(
    png(2, [
      [253, 155, 67, 95],
      [0, 0, 255, 255],
      [253, 155, 67, 153],
      [0, 0, 0, 0],
    ]),
    2,
    new Uint8Array([1, 1, 1, 1]),
    palette,
  )
  assert.deepEqual(result.diagnostics, {
    lowAlpha: 1,
    distance: 1,
    ambiguous: 0,
  })
  assert.equal(
    Object.values(result.diagnostics).reduce((sum, n) => sum + n, 0),
    result.unclassified,
  )
  assert.equal(
    result.valid + result.unclassified + result.unpainted,
    result.total,
  )
})

test('마스크는 위쪽 행을 북쪽으로 해석하고 축 순서를 뒤집지 않는다', () => {
  const mask = radiusMask({ lat: 0.75, lng: 0 }, 30000, {
    bbox: [-0.5, 0, 0.5, 1],
    size: 2,
  })
  assert.deepEqual([...mask], [1, 1, 0, 0])
})

test('완화 후보도 투명·낮은 alpha·거리 초과·애매한 색은 미분류로 남긴다', () => {
  const profile = { alphaMin: 16, maxDistance: 20, minGap: 2 }
  const classify = createPixelClassifier(palette, profile)
  assert.equal(classify(253, 155, 67, 0).reason, 'transparent')
  assert.equal(classify(253, 155, 67, 15).reason, 'lowAlpha')
  assert.equal(classify(253, 155, 67, 16).grade, 5)
  assert.equal(classify(0, 0, 255, 255).reason, 'distance')
  // 사용자 입력으로 운영 프로필을 바꾸는 기능은 없고 검토 함수에만 명시적으로 전달한다.
  assert.equal(
    createPixelClassifier(palette)(253, 155, 67, 16).reason,
    'lowAlpha',
  )
})

test('사용자가 확인한 RGBA 5개만 지정 등급으로 우선 분류한다', () => {
  const classify = createPixelClassifier(palette)
  const unreviewed = createPixelClassifier(palette, undefined, {
    useReviewedColors: false,
  })
  for (const item of REVIEWED_COLORS) {
    assert.equal(classify(...item.rgba).grade, item.grade)
    assert.equal(classify(...item.rgba).reason, 'reviewed')
    assert.equal(classify(...item.rgba).reviewVersion, REVIEWED_COLORS_VERSION)
    const changedAlpha = [...item.rgba]
    changedAlpha[3]--
    assert.notEqual(classify(...changedAlpha).reason, 'reviewed')
    const changedRgb = [...item.rgba]
    changedRgb[2]--
    assert.notEqual(classify(...changedRgb).reason, 'reviewed')
  }
  assert.equal(unreviewed(255, 255, 174, 19).reason, 'lowAlpha')
  const otherPalette = palette.map((item) => ({ ...item }))
  otherPalette[9].color = '#bd0027'
  assert.equal(
    createPixelClassifier(otherPalette)(255, 255, 174, 19).reason,
    'lowAlpha',
  )
  const result = countPixels(
    png(2, [
      [254, 222, 124, 214],
      [255, 242, 156, 214],
      [254, 238, 150, 214],
      [255, 255, 174, 19],
    ]),
    2,
    new Uint8Array([1, 1, 1, 1]),
    palette,
  )
  assert.deepEqual(result.counts, [1, 2, 1, 0, 0, 0, 0, 0, 0, 0])
  assert.equal(result.unclassified, 0)
  assert.equal(result.score, 100 / 9)
})

test('검토 색상의 제한된 이웃만 추정하고 alpha·팔레트·색상 경계를 유지한다', () => {
  const classify = createPixelClassifier(palette)
  for (const [rgba, grade] of [
    [[253, 222, 124, 214], 3],
    [[255, 241, 156, 214], 2],
    [[255, 255, 173, 20], 1],
    [[255, 248, 166, 214], 2],
  ]) {
    assert.equal(classify(...rgba).grade, grade)
    assert.equal(classify(...rgba).reason, 'inferred')
  }
  assert.equal(classify(254, 222, 118, 214).reason, 'inferred')
  assert.notEqual(classify(254, 222, 117, 214).reason, 'inferred')
  assert.notEqual(classify(254, 222, 124, 210).reason, 'inferred')
  assert.notEqual(classify(254, 222, 124, 153).reason, 'inferred')
  assert.notEqual(
    createPixelClassifier(palette, undefined, { useInferredColors: false })(
      253,
      222,
      124,
      214,
    ).reason,
    'inferred',
  )
  assert.equal(
    createPixelClassifier(palette, undefined, { useInferredColors: false })(
      254,
      222,
      124,
      214,
    ).reason,
    'reviewed',
  )
  const other = palette.map((item) => ({ ...item }))
  other[9].color = '#bd0027'
  assert.notEqual(
    createPixelClassifier(other)(253, 222, 124, 214).reason,
    'inferred',
  )
  const result = countPixels(
    png(2, [
      [254, 222, 124, 214],
      [253, 222, 124, 214],
      [255, 255, 173, 20],
      [0, 0, 0, 0],
    ]),
    2,
    new Uint8Array([1, 1, 1, 1]),
    palette,
  )
  assert.deepEqual(result.evidence, { reviewed: 1, inferred: 2 })
  assert.equal(result.unclassified, 0)
  assert.equal(result.unpainted, 1)
})
