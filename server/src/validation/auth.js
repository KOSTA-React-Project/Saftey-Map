// 회원가입·로그인 입력 규칙 — 프론트(src/api/authApi.js)와 같은 규칙을 서버에서도 검사
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64
export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 12

const EMAIL_MAX = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function asText(value) {
  return typeof value === 'string' ? value : ''
}

export function normalizeEmail(email) {
  return asText(email).trim().toLowerCase()
}

function validateEmail(email, errors) {
  const trimmed = asText(email).trim()
  if (!trimmed) errors.push('이메일을 입력하세요.')
  else if (trimmed.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmed))
    errors.push('이메일 형식이 올바르지 않습니다.')
}

// 오류 메시지 배열을 돌려준다.
export function validateSignup({ email, nickname, password, agreed }) {
  const errors = []
  validateEmail(email, errors)

  const trimmedNickname = asText(nickname).trim()
  if (!trimmedNickname) errors.push('닉네임을 입력하세요.')
  else if (
    trimmedNickname.length < NICKNAME_MIN ||
    trimmedNickname.length > NICKNAME_MAX
  )
    errors.push(`닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력하세요.`)

  const passwordText = asText(password)
  if (!passwordText) errors.push('비밀번호를 입력하세요.')
  else if (
    passwordText.length < PASSWORD_MIN ||
    passwordText.length > PASSWORD_MAX
  )
    errors.push(`비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력하세요.`)

  if (agreed !== true) errors.push('이용약관 및 개인정보 처리에 동의해주세요.')

  return errors
}

export function validateLogin({ email, password }) {
  const errors = []
  validateEmail(email, errors)
  if (!asText(password)) errors.push('비밀번호를 입력하세요.')
  return errors
}
