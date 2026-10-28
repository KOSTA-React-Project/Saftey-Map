import express from 'express'
import { createCompareRouter } from './routes/compare.js'
import { createCrimeRouter } from './routes/crime.js'
import { createNotesRouter, HttpError } from './notes/router.js'

// pool: 서버 상태 확인(/api/health/db)용 DB 연결. 테스트에서는 생략 가능
export function createApp({
  pool,
  repository,
  authenticate = (req, res, next) => next(),
  authRouter,
  crimeOptions,
  compareOptions,
  allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'],
} = {}) {
  const app = express()
  app.disable('x-powered-by')

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      message: '우리동네 안심노트 서버가 실행 중입니다.',
    })
  })

  app.get('/api/health/db', async (_req, res) => {
    try {
      await pool.execute('SELECT 1 AS connected')

      res.json({
        status: 'ok',
        database: 'connected',
      })
    } catch {
      res.status(503).json({
        status: 'error',
        message: '데이터베이스에 연결할 수 없습니다.',
      })
    }
  })

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
        return next(new HttpError(403, '허용되지 않은 요청 출처입니다.'))
      }
      if (!req.is('application/json'))
        return next(new HttpError(415, 'JSON 형식으로 요청하세요.'))
    }
    next()
  })
  app.use(express.json({ limit: '32kb' }))
  // 회원가입·로그인 API (index.js에서 전달, 테스트에서는 생략 가능)
  if (authRouter) app.use('/api/auth', authRouter)
  app.use('/api/public-data', createCrimeRouter(crimeOptions))
  app.use('/api/public-data', createCompareRouter(compareOptions))
  app.use('/api', createNotesRouter({ repository, authenticate }))
  app.use((req, res) =>
    res.status(404).json({ message: 'API를 찾을 수 없습니다.' }),
  )
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error instanceof HttpError)
      return res.status(error.status).json({ message: error.message })
    if (error.type === 'entity.parse.failed')
      return res
        .status(400)
        .json({ message: 'JSON 입력값이 올바르지 않습니다.' })
    if (error.type === 'entity.too.large')
      return res.status(413).json({ message: '요청 크기가 너무 큽니다.' })
    res.status(500).json({
      message:
        '안심노트 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    })
  })
  return app
}
