// 신규 회원 이메일 정책. 프론트와 서버가 같은 규칙/안내 문구를 사용한다.
const EMAIL_MAX = 254
const ASCII_EMAIL = /^[!-~]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getSignupEmailError(value) {
  const email = typeof value === 'string' ? value.trim() : ''
  if (!email) return '이메일을 입력하세요.'
  if (!ASCII_EMAIL.test(email))
    return '이메일은 영문, 숫자 및 이메일용 특수문자로 입력하세요.'
  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email))
    return '이메일 형식이 올바르지 않습니다.'
  return null
}
