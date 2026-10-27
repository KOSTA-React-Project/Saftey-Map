// 회원 API — 서버 구현 전 임시(mock) 버전. localStorage에 저장한다.
// 서버가 생기면 각 함수 안을 fetch 호출로 바꾸면 되고, 화면 코드는 그대로 쓸 수 있다.
//   POST /api/auth/signup  → signup (가입 후 바로 로그인)
//   POST /api/auth/login   → login
//   POST /api/auth/logout  → logout
//   GET  /api/auth/me      → getCurrentUser
// 브라우저 저장은 데모용이다. 실제 서비스에선 서버가 비밀번호를 솔트와 함께
// 느린 해시(bcrypt 등)로 저장하고, 세션은 HttpOnly 쿠키로 관리해야 한다.

const USERS_KEY = 'safety-map:users'
const SESSION_KEY = 'safety-map:session'

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64
export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 12

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function readUsers() {
  const saved = localStorage.getItem(USERS_KEY)
  if (saved == null) return []
  let users
  try {
    users = JSON.parse(saved)
  } catch {
    users = null
  }
  if (!Array.isArray(users)) {
    throw new ApiError(500, '저장된 회원 정보를 읽을 수 없습니다.')
  }
  return users
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

// 세션 값이 깨져 있으면 로그아웃 상태로 본다.
function readSessionUserId() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.userId ?? null
  } catch {
    return null
  }
}

function startSession(userId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }))
}

// 네트워크 요청처럼 비동기로 동작하게 한다.
function respond(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), 100))
}

function fail(status, message) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new ApiError(status, message)), 100),
  )
}

function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase()
}

async function hashPassword(email, password) {
  const data = new TextEncoder().encode(`${email}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// 비밀번호 해시는 응답에 포함하지 않는다.
function toPublicUser({ id, email, nickname, role }) {
  return { id, email, nickname, role }
}

function validateEmail(email, errors) {
  const trimmed = (email ?? '').trim()
  if (!trimmed) errors.push('이메일을 입력하세요.')
  else if (!EMAIL_PATTERN.test(trimmed))
    errors.push('이메일 형식이 올바르지 않습니다.')
}

// 서버에서도 똑같이 검사해야 하는 입력값 규칙. 오류 메시지 배열을 돌려준다.
export function validateSignup({
  email,
  nickname,
  password,
  passwordConfirm,
  agreed,
}) {
  const errors = []
  validateEmail(email, errors)

  const trimmedNickname = (nickname ?? '').trim()
  if (!trimmedNickname) errors.push('닉네임을 입력하세요.')
  else if (
    trimmedNickname.length < NICKNAME_MIN ||
    trimmedNickname.length > NICKNAME_MAX
  )
    errors.push(`닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력하세요.`)

  if (!password) errors.push('비밀번호를 입력하세요.')
  else if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
    errors.push(`비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력하세요.`)

  if (!passwordConfirm) errors.push('비밀번호 확인을 입력하세요.')
  else if (password !== passwordConfirm)
    errors.push('비밀번호가 일치하지 않습니다.')

  if (!agreed) errors.push('이용약관 및 개인정보 처리에 동의해주세요.')

  return errors
}

export function validateLogin({ email, password }) {
  const errors = []
  validateEmail(email, errors)
  if (!password) errors.push('비밀번호를 입력하세요.')
  return errors
}

export async function signup(input) {
  const errors = validateSignup(input)
  if (errors.length > 0) return fail(400, errors.join(' '))

  const users = readUsers()
  const email = normalizeEmail(input.email)
  if (users.some((user) => user.email === email)) {
    return fail(409, '이미 가입된 이메일입니다.')
  }

  const user = {
    id: crypto.randomUUID(),
    email,
    nickname: input.nickname.trim(),
    role: 'USER', // 입력에 role이 있어도 무시. ADMIN은 서버에서만 부여
    passwordHash: await hashPassword(email, input.password),
    createdAt: new Date().toISOString(),
  }
  writeUsers([...users, user])
  startSession(user.id)
  return respond(toPublicUser(user))
}

export async function login(input) {
  const errors = validateLogin(input)
  if (errors.length > 0) return fail(400, errors.join(' '))

  const email = normalizeEmail(input.email)
  const user = readUsers().find((item) => item.email === email)
  const passwordHash = await hashPassword(email, input.password)
  // 이메일과 비밀번호 중 무엇이 틀렸는지 알려주지 않는다.
  if (!user || user.passwordHash !== passwordHash) {
    return fail(401, '이메일 또는 비밀번호가 올바르지 않습니다.')
  }
  startSession(user.id)
  return respond(toPublicUser(user))
}

export async function logout() {
  localStorage.removeItem(SESSION_KEY)
  return respond(null)
}

// 로그인하지 않았으면 null
export async function getCurrentUser() {
  const userId = readSessionUserId()
  if (userId == null) return respond(null)
  const user = readUsers().find((item) => item.id === userId)
  if (!user) {
    localStorage.removeItem(SESSION_KEY)
    return respond(null)
  }
  return respond(toPublicUser(user))
}
