import mysql from 'mysql2/promise'
import { createApp } from './app.mjs'
import { createMysqlNotes } from './mysqlNotes.mjs'

const host = process.env.HOST ?? '127.0.0.1'
const devAuth = process.env.DEV_AUTH_ENABLED === 'true'
if (
  devAuth &&
  (process.env.NODE_ENV !== 'development' ||
    !['127.0.0.1', 'localhost', '::1'].includes(host))
) {
  throw new Error(
    '개발 사용자 연결은 development 모드의 로컬 서버에서만 사용할 수 있습니다.',
  )
}
for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
  if (!process.env[key]) throw new Error(`${key}를 server/.env에 설정하세요.`)
}
const devUserId = Number(process.env.DEV_USER_ID)
if (devAuth && (!Number.isInteger(devUserId) || devUserId <= 0))
  throw new Error('DEV_USER_ID를 설정하세요.')

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  timezone: 'Z',
  decimalNumbers: true,
  connectionLimit: 5,
})

// DATETIME 생성과 mysql2의 UTC 해석 기준을 맞춘다. 새 연결마다 적용한다.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) connection.destroy()
  })
})

// 로그인 담당자는 이 미들웨어 대신 검증된 세션/JWT에서 req.user = { id, role }를 연결한다.
// 요청 본문의 authorId, 임의 헤더, localStorage 역할은 인증에 사용하지 않는다.
async function authenticate(req, res, next) {
  if (devAuth) {
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
        req.socket.remoteAddress,
      )
    ) {
      return res
        .status(403)
        .json({ message: '개발 사용자 연결은 로컬 요청만 허용합니다.' })
    }
    const [users] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [devUserId],
    )
    req.user = users[0]
  }
  next()
}

const app = createApp({
  repository: createMysqlNotes(pool),
  authenticate,
  allowedOrigins: (
    process.env.FRONTEND_ORIGINS ??
    'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim()),
})
await pool.query('SELECT 1')
const server = app.listen(Number(process.env.PORT ?? 3001), host, () => {
  console.log(`안심노트 API: http://${host}:${server.address().port}`)
  if (devAuth)
    console.log(
      '로컬 개발 사용자 연결이 켜져 있습니다. 실제 로그인 인증은 아직 연결되지 않았습니다.',
    )
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () =>
    server.close(async () => {
      await pool.end()
    }),
  )
}
