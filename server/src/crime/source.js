import process from 'node:process'

const BASE = 'https://www.safemap.go.kr/openapi2/'
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export async function readLimited(response, limit) {
  if (Number(response.headers.get('content-length')) > limit)
    throw new Error('size')
  const reader = response.body.getReader()
  const chunks = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) throw new Error('size')
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks)
  } finally {
    await reader.cancel().catch(() => {})
  }
}

export function validatePng(body, size) {
  if (
    body.length < 24 ||
    !body.subarray(0, 8).equals(SIGNATURE) ||
    body.toString('ascii', 12, 16) !== 'IHDR' ||
    body.readUInt32BE(16) !== size ||
    body.readUInt32BE(20) !== size
  )
    throw new Error('invalid PNG')
}

// 키·원천 주소를 브라우저에서 받지 않는다. 읽기 시간까지 fetch의 signal 적용.
export function createCrimeSource({
  serviceKey = process.env.SAFEMAP_KEY,
  fetchImpl = fetch,
} = {}) {
  async function upstream(path, params, signal) {
    if (!serviceKey) throw new Error('missing key')
    const url = new URL(path, BASE)
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value)
    url.searchParams.set('serviceKey', serviceKey)
    const response = await fetchImpl(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
      redirect: 'error',
    })
    if (!response.ok) throw new Error('upstream')
    return response
  }
  async function image({ bbox, size, style, signal }) {
    const response = await upstream(
      'IF_0087_WMS',
      {
        service: 'WMS',
        request: 'GetMap',
        version: '1.1.1',
        layers: 'A2SM_CRMNLHSPOT_TOT',
        styles: style,
        srs: 'EPSG:4326',
        bbox: bbox.join(','),
        width: size,
        height: size,
        format: 'image/png',
        transparent: 'TRUE',
      },
      signal,
    )
    if (
      !(response.headers.get('content-type') ?? '')
        .toLowerCase()
        .includes('image/png')
    )
      throw new Error('not PNG')
    const body = await readLimited(response, 3 * 1024 * 1024)
    validatePng(body, size)
    return body
  }
  async function legend(signal) {
    const response = await upstream('lgdInfo', { intId: 'IF_0087' }, signal)
    const raw = JSON.parse(
      (await readLimited(response, 256 * 1024)).toString('utf8'),
    )
    const items = raw.body?.items?.item
    if (
      raw.header?.resultCode !== '00' ||
      !Array.isArray(items) ||
      items.length !== 10
    )
      throw new Error('invalid legend')
    const palette = items
      .map((item) => ({
        grade: Number(item.LGD_NO),
        color: item.IMAGE?.toLowerCase(),
      }))
      .sort((a, b) => a.grade - b.grade)
    if (
      palette.some(
        (item, index) =>
          item.grade !== index + 1 || !/^#[0-9a-f]{6}$/.test(item.color),
      ) ||
      new Set(palette.map((item) => item.color)).size !== 10
    )
      throw new Error('ambiguous palette')
    return palette
  }
  return { upstream, image, legend, configured: Boolean(serviceKey) }
}
