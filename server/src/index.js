import process from 'node:process'
import express from 'express'
import pool from './db.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'

app.disable('x-powered-by')

app.use(express.json({ limit: '16kb' }))

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

app.listen(port, host, () => {
  console.log(`서버 실행: http://${host}:${port}`)
})
