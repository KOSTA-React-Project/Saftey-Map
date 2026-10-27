import express from 'express'
import { createNotesRouter, HttpError } from './notes.mjs'

export function createApp({
  repository,
  authenticate = (req, res, next) => next(),
  allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'],
} = {}) {
  const app = express()
  app.disable('x-powered-by')
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
    res
      .status(500)
      .json({
        message:
          '안심노트 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      })
  })
  return app
}
