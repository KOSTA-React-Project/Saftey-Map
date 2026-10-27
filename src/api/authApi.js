// 회원 API — server/src/routes/auth.js 호출
//   POST /api/auth/signup  → signup (가입 후 바로 로그인)
//   POST /api/auth/login   → login
//   POST /api/auth/logout  → logout
//   GET  /api/auth/me      → getCurrentUser
// 로그인 상태는 서버가 HttpOnly 쿠키로 관리하므로 프론트는 토큰을 직접 다루지 않는다.
// 개발 중에는 vite.config.js의 proxy가 /api 요청을 서버(localhost:3000)로 넘긴다.

const BASE_URL = '/api/auth'

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

// 실패하면 서버의 { message }를 담은 ApiError를 던진다. 서버에 닿지 못하면 status 0
async function request(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(
      0,
      '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    )
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
    )
  }
  return data
}

function validateEmail(email, errors) {
  const trimmed = (email ?? '').trim()
  if (!trimmed) errors.push('이메일을 입력하세요.')
  else if (!EMAIL_PATTERN.test(trimmed))
    errors.push('이메일 형식이 올바르지 않습니다.')
}

// 서버(server/src/validation/auth.js)에서도 같은 규칙으로 검사한다. 오류 메시지 배열을 돌려준다.
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
  if (errors.length > 0) throw new ApiError(400, errors.join(' '))

  // 비밀번호 확인은 화면에서만 검사하므로 보내지 않는다.
  const { user } = await request('/signup', {
    method: 'POST',
    body: {
      email: input.email,
      nickname: input.nickname,
      password: input.password,
      agreed: input.agreed,
    },
  })
  return user
}

export async function login(input) {
  const errors = validateLogin(input)
  if (errors.length > 0) throw new ApiError(400, errors.join(' '))

  const { user } = await request('/login', {
    method: 'POST',
    body: { email: input.email, password: input.password },
  })
  return user
}

export async function logout() {
  // 서버가 POST 요청은 JSON 형식만 받으므로 빈 객체를 보낸다
  await request('/logout', { method: 'POST', body: {} })
  return null
}

// 로그인하지 않았으면 null
export async function getCurrentUser() {
  const data = await request('/me')
  return data?.user ?? null
}
