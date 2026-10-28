import process from 'node:process'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createCrimeSource } from '../crime/source.js'
import { validConditions, analyzeComparison } from '../crime/analyze.js'

export function createCompareRouter({
  serviceKey = process.env.SAFEMAP_KEY,
  fetchImpl = fetch,
  enabled = process.env.SAFEMAP_ANALYSIS_ENABLED === 'true',
  // 등급 방향·공통 범례·좌표·이용 조건 검토가 끝난 서버에서만 활성화한다.
  verified = process.env.SAFEMAP_ANALYSIS_VERIFIED === 'true',
  palette = process.env.SAFEMAP_ANALYSIS_PALETTE ?? '',
  period = process.env.SAFEMAP_ANALYSIS_PERIOD ?? '',
} = {}) {
  const router = Router()
  const source = createCrimeSource({ serviceKey, fetchImpl })
  let active = false
  router.post(
    '/crime-compare',
    rateLimit({
      windowMs: 60_000,
      limit: 6,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        code: 'RATE_LIMITED',
        message: '비교 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      },
    }),
    async (req, res) => {
      if (!validConditions(req.body))
        return res.status(400).json({
          code: 'INVALID_CONDITIONS',
          message: '국내 A/B 지점과 공통 반경 500m 또는 1km를 확인해 주세요.',
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
          message: '다른 비교를 처리 중입니다. 잠시 후 다시 시도해 주세요.',
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
        A: { lat: req.body.A.lat, lng: req.body.A.lng },
        B: { lat: req.body.B.lat, lng: req.body.B.lng },
      }
      try {
        const result = await analyzeComparison(conditions, source, {
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
