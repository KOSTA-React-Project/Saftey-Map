// 계정·인증 방식이 정해지면 로그인 담당이 이 경계에 실제 세션을 연결한다.
// ADMIN은 화면 연결용 역할 계약이며 계정명이나 비밀번호가 아니다.
export function getAdminAccess(session) {
  if (session == null) return 'unconfigured'
  if (session.status === 'loading') return 'loading'
  if (session.status !== 'authenticated' || !session.user)
    return 'loginRequired'
  return session.user.role === 'ADMIN' ? 'allowed' : 'forbidden'
}
