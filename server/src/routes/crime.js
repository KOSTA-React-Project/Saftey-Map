import { createCrimeSource, readLimited } from '../crime/source.js'
import process from 'node:process'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

const STYLES = new Set(
  ['Tot', 'Brglr', 'Rape', 'Violn', 'Theft', 'Murder'].map(
    (type) => `A2SM_CrmnlHspot_Tot_${type}`,
  ),
)
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

// 원천 URL·레이어·좌표계는 서버에서 고정한다. 임의 URL을 받는 프록시가 아니다.
export function createCrimeRouter({
  serviceKey = process.env.SAFEMAP_KEY,
  fetchImpl = fetch,
} = {}) {
  const router = Router()
  const cache = new Map()
  let active = 0
  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { message: '지도 요청이 많습니다. 잠시 후 다시 시도해 주세요.' },
    }),
  )

  const { upstream } = createCrimeSource({ serviceKey, fetchImpl })

  router.get('/crime-image', async (req, res) => {
    const { bbox, size = '1024', style = 'A2SM_CrmnlHspot_Tot_Tot' } = req.query
    const coords =
      typeof bbox === 'string' && bbox.length <= 160
        ? bbox.split(',').map(Number)
        : []
    if (
      typeof bbox !== 'string' ||
      bbox.split(',').some((value) => !value.trim()) ||
      coords.length !== 4 ||
      !coords.every(
        (value) =>
          Number.isFinite(value) && value >= -100000 && value <= 1000000,
      ) ||
      coords[0] >= coords[2] ||
      coords[1] >= coords[3] ||
      coords[2] - coords[0] > 65536 ||
      coords[3] - coords[1] > 65536 ||
      !['256', '512', '1024'].includes(size) ||
      !STYLES.has(style)
    ) {
      return res
        .status(400)
        .json({ message: '지도 범위와 이미지 조건을 확인해 주세요.' })
    }
    if (!serviceKey)
      return res
        .status(503)
        .json({ message: '공공지도 서버 설정이 필요합니다.' })
    const key = `${coords.join(',')}:${size}:${style}`
    let entry = cache.get(key)
    if (!entry || entry.expires <= Date.now()) {
      if (active >= 4)
        return res.status(503).json({
          message: '지도를 준비 중입니다. 잠시 후 다시 시도해 주세요.',
        })
      active++
      const promise = (async () => {
        const response = await upstream('IF_0087_WMS', {
          layers: 'A2SM_CRMNLHSPOT_TOT',
          styles: style,
          srs: 'EPSG:5181',
          bbox: coords.join(','),
          format: 'image/png',
          width: size,
          height: size,
          transparent: 'TRUE',
        })
        if (
          !(response.headers.get('content-type') ?? '')
            .toLowerCase()
            .includes('image/png')
        )
          throw new Error('not PNG')
        const body = await readLimited(response, 3 * 1024 * 1024)
        if (
          body.length < 24 ||
          !body.subarray(0, 8).equals(PNG) ||
          body.toString('ascii', 12, 16) !== 'IHDR' ||
          body.readUInt32BE(16) !== Number(size) ||
          body.readUInt32BE(20) !== Number(size)
        )
          throw new Error('invalid PNG')
        return body
      })().finally(() => {
        active--
      })
      entry = { promise, expires: Date.now() + 300000 }
      cache.set(key, entry)
      if (cache.size > 16) cache.delete(cache.keys().next().value)
    }
    try {
      const body = await entry.promise
      res.set('Cache-Control', 'public, max-age=300').type('png').send(body)
    } catch {
      if (cache.get(key) === entry) cache.delete(key)
      res
        .status(502)
        .json({ message: '공공지도 이미지를 불러오지 못했습니다.' })
    }
  })

  let legendCache = null
  router.get('/crime-legend', async (_req, res) => {
    if (!serviceKey)
      return res
        .status(503)
        .json({ message: '공공지도 서버 설정이 필요합니다.' })
    try {
      if (!legendCache || legendCache.expires <= Date.now()) {
        const response = await upstream('lgdInfo', { intId: 'IF_0087' })
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
        const normalized = items.map((item) => ({
          LGD_NO: Number(item.LGD_NO),
          IMAGE: item.IMAGE,
        }))
        if (
          new Set(normalized.map((item) => item.LGD_NO)).size !== 10 ||
          normalized.some(
            (item) =>
              item.LGD_NO < 1 ||
              item.LGD_NO > 10 ||
              typeof item.IMAGE !== 'string' ||
              !/^#[0-9a-f]{6}$/i.test(item.IMAGE),
          )
        )
          throw new Error('invalid palette')
        legendCache = {
          data: {
            header: { resultCode: '00' },
            body: { items: { item: normalized } },
          },
          expires: Date.now() + 3600000,
        }
      }
      res.set('Cache-Control', 'public, max-age=3600').json(legendCache.data)
    } catch {
      res.status(502).json({ message: '공공지도 범례를 불러오지 못했습니다.' })
    }
  })
  return router
}
