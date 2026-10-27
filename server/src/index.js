import process from 'node:process'
import pool from './db.js'
import { createApp } from './app.js'
import { createMysqlNotes } from './notes/mysqlRepository.js'
import authRouter from './routes/auth.js'
import { readSessionUserId } from './auth/session.js'

const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'

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
const devUserId = Number(process.env.DEV_USER_ID)
if (devAuth && (!Number.isInteger(devUserId) || devUserId <= 0))
  throw new Error('DEV_USER_ID를 설정하세요.')

// 로그인 쿠키(JWT)를 검증해 req.user = { id, role }를 연결한다. role은 매번 DB에서 읽는다.
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
    req.user = users[0] && { ...users[0], id: Number(users[0].id) }
  } else {
    const userId = readSessionUserId(req)
    if (userId) {
      const [users] = await pool.execute(
        'SELECT id, role FROM users WHERE id = ? LIMIT 1',
        [userId],
      )
      req.user = users[0]
    }
  }
  next()
}

const app = createApp({
  pool,
  repository: createMysqlNotes(pool),
  authenticate,
  authRouter,
  allowedOrigins: (
    process.env.FRONTEND_ORIGINS ??
    'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim()),
})

// nginx 같은 프록시 뒤에서 실행하면 프록시 단계 수(보통 1)를 지정해 실제 사용자 IP를 읽는다
// (로그인·회원가입 요청 횟수 제한이 사용자별로 동작하도록). 비어 있으면 사용 안 함
const trustProxy = Number(process.env.TRUST_PROXY || 0)
if (trustProxy > 0) app.set('trust proxy', trustProxy)

const server = app.listen(port, host, () => {
  console.log(`서버 실행: http://${host}:${port}`)
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
