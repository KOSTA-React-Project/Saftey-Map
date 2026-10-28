import process from 'node:process'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createCrimeSource } from '../crime/source.js'
import {
  ANALYSIS_VERSION,
  CLASSIFICATION,
  EARTH_RADIUS,
  countPixels,
  geometryFor,
  radiusMask,
} from '../crime/analyze.js'
import { CRIME_TYPES } from '../shared/crimeTypes.js'

// 지도 탐색에서 고른 지점 하나의 반경 분석 — 두 지역 비교(compare.js)와 같은 계산·검증을 한 지점에만 적용
// 요청 { point: { lat, lng }, radius: 500 | 1000 } → 응답 { conditions, result, synthetic: false, ... }
export function validPoint(value) {
  const point = value?.point
  return (
    Boolean(value) &&
    [500, 1000].includes(value.radius) &&
    Boolean(point) &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= 33 &&
    point.lat <= 39 &&
    point.lng >= 124 &&
    point.lng <= 132
  )
}

// 비교 분석(analyzeComparison)의 한 지점 부분과 같은 순서: 범례 확인 → 유형별 원본 이미지 → 픽셀 집계
export async function analyzePoint(
  conditions,
  source,
  { signal, expectedPalette } = {},
) {
  const palette = await source.legend(signal)
  if (
    expectedPalette &&
    JSON.stringify(palette.map((item) => item.color)) !==
      JSON.stringify(expectedPalette)
  )
    throw new Error('palette changed')
  const geometry = geometryFor(conditions.point, conditions.radius)
  const mask = radiusMask(conditions.point, conditions.radius, geometry)
  const byCrimeType = {}
  // 6장을 동시에 요청하지 않고 원본 이미지 한 장씩 처리한다.
  for (const type of CRIME_TYPES) {
    signal.throwIfAborted()
    const body = await source.image({ ...geometry, style: type.style, signal })
    signal.throwIfAborted()
    byCrimeType[type.id] = countPixels(body, geometry.size, mask, palette)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return {
    conditions,
    result: { ...byCrimeType.TOT, byCrimeType, geometry },
    synthetic: false,
    queriedAt: new Date().toISOString(),
    version: ANALYSIS_VERSION,
    source: {
      name: '생활안전지도 · 경찰청',
      interface: 'IF_0087_WMS',
      crs: 'EPSG:4326',
      axisOrder: 'longitude,latitude',
      palette,
      classifier: CLASSIFICATION,
      distanceModel: 'mean-earth-sphere',
      earthRadius: EARTH_RADIUS,
    },
  }
}

export function createCrimeScoreRouter({
  serviceKey = process.env.SAFEMAP_KEY,
  fetchImpl = fetch,
  enabled = process.env.SAFEMAP_ANALYSIS_ENABLED === 'true',
  // 비교 분석과 같은 서버 설정을 쓴다. 검토가 끝난 서버에서만 활성화.
  verified = process.env.SAFEMAP_ANALYSIS_VERIFIED === 'true',
  palette = process.env.SAFEMAP_ANALYSIS_PALETTE ?? '',
  period = process.env.SAFEMAP_ANALYSIS_PERIOD ?? '',
} = {}) {
  const router = Router()
  const source = createCrimeSource({ serviceKey, fetchImpl })
  let active = false
  router.post(
    '/crime-score',
    rateLimit({
      windowMs: 60_000,
      limit: 6,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        code: 'RATE_LIMITED',
        message: '분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      },
    }),
    async (req, res) => {
      if (!validPoint(req.body))
        return res.status(400).json({
          code: 'INVALID_CONDITIONS',
          message: '국내 지점과 반경 500m 또는 1km를 확인해 주세요.',
        })
      const expectedPalette = palette
        .toLowerCase()
        .split(',')
        .map((color) => color.trim())
      if (
        !enabled ||
        !verified ||
        !period.trim() ||
        expectedPalette.length !== 10 ||
        expectedPalette.some((color) => !/^#[0-9a-f]{6}$/.test(color)) ||
        new Set(expectedPalette).size !== 10
      )
        return res.status(503).json({
          code: 'ANALYSIS_NOT_VERIFIED',
          message:
            '실제 분석 연결은 준비되었지만 범례·등급 방향·기준 기간·이용 조건 검증 및 서버 설정이 필요합니다. 가상 점수는 제공하지 않습니다.',
        })
      if (!source.configured)
        return res.status(503).json({
          code: 'SOURCE_NOT_CONFIGURED',
          message: '공공지도 서버 키 설정이 필요합니다.',
        })
      if (active)
        return res.status(503).json({
          code: 'ANALYSIS_BUSY',
          message: '다른 분석을 처리 중입니다. 잠시 후 다시 시도해 주세요.',
        })
      active = true
      const controller = new AbortController()
      const abort = () => controller.abort()
      res.on('close', abort)
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(45000),
      ])
      // 사용자 입력의 주소/추가 필드를 서버 응답으로 재전달하지 않는다.
      const conditions = {
        radius: req.body.radius,
        point: { lat: req.body.point.lat, lng: req.body.point.lng },
      }
      try {
        const result = await analyzePoint(conditions, source, {
          signal,
          expectedPalette,
        })
        result.source.period = period
        if (!res.destroyed) res.json(result)
      } catch {
        if (!res.destroyed)
          res.status(502).json({
            code: 'ANALYSIS_FAILED',
            message:
              '원본 이미지·범례를 분석하지 못했습니다. 이전 결과나 가상 점수로 대체하지 않습니다.',
          })
      } finally {
        active = false
        res.off('close', abort)
      }
    },
  )
  return router
}
