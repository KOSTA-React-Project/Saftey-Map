import { createContext, useContext } from 'react'

// AuthProvider가 로그인 상태와 동작을 공유
// session: { status: 'loading' | 'authenticated' | 'unauthenticated', user }
// user: { id, email, nickname, role } — services/adminAccess.js 규격과 같음
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}
