import process from 'node:process'
import jwt from 'jsonwebtoken'

// 로그인 상태는 서명한 JWT를 HttpOnly 쿠키에 담아 유지한다 (브라우저 스크립트로 읽을 수 없음)
const COOKIE_NAME = 'ansim_session'
const SESSION_DAYS = 7
const SECRET_MIN_LENGTH = 32

const secret = process.env.JWT_SECRET

if (!secret) {
  throw new Error('필수 환경 변수가 없습니다: JWT_SECRET')
}
if (secret.length < SECRET_MIN_LENGTH) {
  throw new Error(`JWT_SECRET은 ${SECRET_MIN_LENGTH}자 이상이어야 합니다.`)
}

// COOKIE_SECURE=true면 HTTPS 연결에서만 쿠키를 보낸다 (HTTPS 배포 시 켜기)
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
}

export function setSessionCookie(res, userId) {
  const token = jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: `${SESSION_DAYS}d`,
  })
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions)
}

// 요청의 Cookie 헤더에서 로그인 쿠키 값을 찾는다
function readSessionToken(req) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index > -1 && part.slice(0, index).trim() === COOKIE_NAME) {
      return part.slice(index + 1).trim()
    }
  }
  return null
}

// 쿠키가 없거나 서명·만료가 맞지 않으면 null
export function readSessionUserId(req) {
  const token = readSessionToken(req)
  if (!token) return null
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] }).sub ?? null
  } catch {
    return null
  }
}
