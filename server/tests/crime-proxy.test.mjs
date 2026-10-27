import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../src/app.js'

const imagePath =
  '/api/public-data/crime-image?bbox=190000,440000,206384,456384&size=256&style=A2SM_CrmnlHspot_Tot_Tot'

async function fixture(t, fetchImpl, serviceKey = 'fixture-server-secret') {
  const server = createApp({ crimeOptions: { fetchImpl, serviceKey } }).listen(
    0,
    '127.0.0.1',
  )
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`)
}

// PNG 메타데이터 검증용 최소 헤더. 실제 지도 이미지 fixture는 외부 호출로 가져오지 않는다.
function pngHeader(size = 256) {
  const body = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(body)
  body.write('IHDR', 12)
  body.writeUInt32BE(size, 16)
  body.writeUInt32BE(size, 20)
  return body
}

test('WMS 요청은 고정 원천에 서버 키와 검증된 조건만 전달하고 이미지를 캐시한다', async (t) => {
  let count = 0
  const request = await fixture(t, async (url) => {
    count++
    assert.equal(url.origin, 'https://www.safemap.go.kr')
    assert.equal(url.pathname, '/openapi2/IF_0087_WMS')
    assert.equal(url.searchParams.get('serviceKey'), 'fixture-server-secret')
    assert.equal(url.searchParams.get('srs'), 'EPSG:5181')
    assert.equal(url.searchParams.get('layers'), 'A2SM_CRMNLHSPOT_TOT')
    return new Response(pngHeader(), {
      headers: { 'content-type': 'image/png' },
    })
  })
  for (let i = 0; i < 2; i++) {
    const response = await request(imagePath)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal((await response.arrayBuffer()).byteLength, 24)
  }
  assert.equal(count, 1)
})

test('WMS의 잘못된 범위·스타일·이미지 크기는 원천 호출 전에 거절한다', async (t) => {
  let calls = 0
  const request = await fixture(t, async () => {
    calls++
    throw new Error('must not call upstream')
  })
  for (const suffix of [
    'bbox=0,0,0,0',
    'bbox=0,0,9999999,9999999',
    'bbox=0,,1,1',
    'bbox=0,0,100,100&size=4096',
    'bbox=0,0,100,100&style=https://example.com',
    'bbox=0,0,100,100&bbox=0,0,200,200',
  ])
    assert.equal(
      (await request('/api/public-data/crime-image?' + suffix)).status,
      400,
    )
  assert.equal(calls, 0)
})

test('HTTP 200의 XML·가짜 PNG·잘못된 해상도와 요청 실패는 이미지로 제공하지 않는다', async (t) => {
  for (const response of [
    new Response('<error>upstream secret</error>', {
      headers: { 'content-type': 'text/xml' },
    }),
    new Response('<html>error</html>', {
      headers: { 'content-type': 'image/png' },
    }),
    new Response(pngHeader(512), { headers: { 'content-type': 'image/png' } }),
    new Response('large', {
      headers: { 'content-type': 'image/png', 'content-length': '99999999' },
    }),
  ]) {
    const request = await fixture(t, async () => response)
    const result = await request(imagePath)
    assert.equal(result.status, 502)
    assert.equal((await result.text()).includes('secret'), false)
  }
  const request = await fixture(t, async () => {
    throw new Error('timeout: fixture-server-secret')
  })
  const result = await request(imagePath)
  assert.equal(result.status, 502)
  assert.equal((await result.text()).includes('fixture-server-secret'), false)
})

test('키 미설정은 503, 범례는 검증된 10등급만 반환하며 서버 키를 포함하지 않는다', async (t) => {
  const missing = await fixture(
    t,
    async () => {
      throw new Error('must not call')
    },
    '',
  )
  assert.equal((await missing(imagePath)).status, 503)
  const request = await fixture(
    t,
    async () =>
      new Response(
        JSON.stringify({
          header: { resultCode: '00' },
          body: {
            items: {
              item: Array.from({ length: 10 }, (_, i) => ({
                LGD_NO: String(i + 1),
                IMAGE: '#abcdef',
                secret: 'fixture-server-secret',
              })),
            },
          },
        }),
      ),
  )
  const response = await request('/api/public-data/crime-legend')
  assert.equal(response.status, 200)
  const text = await response.text()
  assert.equal(text.includes('fixture-server-secret'), false)
  assert.equal(JSON.parse(text).body.items.item.length, 10)
})
