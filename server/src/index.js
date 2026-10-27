import process from 'node:process'
import cookieParser from 'cookie-parser'
import express from 'express'
import pool from './db.js'
import authRouter from './routes/auth.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'

app.disable('x-powered-by')

app.use(express.json({ limit: '16kb' }))
app.use(cookieParser())

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

app.use('/api/auth', authRouter)

// 처리하지 못한 오류는 JSON으로 응답 (Express 기본 응답은 HTML)
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  if (
    error.type === 'entity.parse.failed' ||
    error.type === 'entity.too.large'
  ) {
    return res.status(400).json({ message: '요청 형식이 올바르지 않습니다.' })
  }
  console.error(error)
  res.status(500).json({ message: '서버에서 오류가 발생했습니다.' })
})

app.listen(port, host, () => {
  console.log(`서버 실행: http://${host}:${port}`)
})
