import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import pool from '../db.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import {
  clearSessionCookie,
  readSessionUserId,
  setSessionCookie,
} from '../auth/session.js'
import {
  normalizeEmail,
  validateLogin,
  validateSignup,
} from '../validation/auth.js'

// 회원 API — 응답의 user는 { id, email, nickname, role } (services/adminAccess.js 규격과 같음)
//   POST /api/auth/signup  → 201 { user } (가입 후 바로 로그인)
//   POST /api/auth/login   → 200 { user }
//   POST /api/auth/logout  → 204
//   GET  /api/auth/me      → 200 { user } (로그인하지 않았으면 user: null)
// 실패 응답은 { message }. 요청이 너무 많으면 429
const router = Router()

// 같은 IP의 요청 횟수 제한 (서버 메모리에 기록, 재시작하면 초기화)
// 프록시 뒤에서는 TRUST_PROXY를 설정해야 사용자별 IP로 센다 (index.js)
const TOO_MANY_REQUESTS = {
  message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
}

// 로그인: 15분에 실패 10번. 성공한 요청은 세지 않음 (비밀번호 대입 방지)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: TOO_MANY_REQUESTS,
})

// 회원가입: 1시간에 50번 (같은 와이파이에서 여러 명이 가입해도 막히지 않을 정도)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: TOO_MANY_REQUESTS,
})

const DUPLICATE_EMAIL = '이미 가입된 이메일입니다.'
const DUPLICATE_NICKNAME = '이미 사용 중인 닉네임입니다.'

function toPublicUser({ id, email, nickname, role }) {
  return { id, email, nickname, role }
}

router.post('/signup', signupLimiter, async (req, res) => {
  const body = req.body ?? {}
  const errors = validateSignup(body)
  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(' ') })
  }

  const email = normalizeEmail(body.email)
  const nickname = body.nickname.trim()

  // 어떤 값이 중복인지 알려주기 위해 먼저 확인 (이메일·닉네임은 대소문자 구분 없이 비교)
  const [duplicates] = await pool.execute(
    'SELECT email, nickname FROM users WHERE email = ? OR nickname = ? LIMIT 2',
    [email, nickname],
  )
  if (duplicates.some((row) => row.email.toLowerCase() === email)) {
    return res.status(409).json({ message: DUPLICATE_EMAIL })
  }
  if (duplicates.length > 0) {
    return res.status(409).json({ message: DUPLICATE_NICKNAME })
  }

  // role은 입력과 상관없이 USER. ADMIN은 DB에서 직접 지정
  const user = { id: randomUUID(), email, nickname, role: 'USER' }
  const passwordHash = await hashPassword(body.password)
  try {
    await pool.execute(
      'INSERT INTO users (id, email, nickname, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.email, user.nickname, passwordHash, user.role],
    )
  } catch (error) {
    // 확인과 저장 사이에 같은 값으로 가입한 경우
    if (error.code === 'ER_DUP_ENTRY') {
      const message = /nickname/i.test(error.sqlMessage)
        ? DUPLICATE_NICKNAME
        : DUPLICATE_EMAIL
      return res.status(409).json({ message })
    }
    throw error
  }

  setSessionCookie(res, user.id)
  res.status(201).json({ user })
})

router.post('/login', loginLimiter, async (req, res) => {
  const body = req.body ?? {}
  const errors = validateLogin(body)
  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(' ') })
  }

  const [rows] = await pool.execute(
    'SELECT id, email, nickname, role, password_hash FROM users WHERE email = ? LIMIT 1',
    [normalizeEmail(body.email)],
  )
  const user = rows[0]
  let matched = false
  if (user) {
    matched = await verifyPassword(body.password, user.password_hash)
  } else {
    // 없는 이메일도 비슷한 시간이 걸리게 해 가입 여부를 추측하기 어렵게 함
    await hashPassword(body.password)
  }
  // 이메일과 비밀번호 중 무엇이 틀렸는지 알려주지 않는다.
  if (!matched) {
    return res
      .status(401)
      .json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })
  }

  setSessionCookie(res, user.id)
  res.json({ user: toPublicUser(user) })
})

router.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.status(204).end()
})

router.get('/me', async (req, res) => {
  const userId = readSessionUserId(req)
  if (!userId) return res.json({ user: null })

  const [rows] = await pool.execute(
    'SELECT id, email, nickname, role FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  // 쿠키는 유효하지만 회원이 없어진 경우
  if (!rows[0]) {
    clearSessionCookie(res)
    return res.json({ user: null })
  }
  res.json({ user: toPublicUser(rows[0]) })
})

export default router
