import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from '../../hooks/useAuth.js'
import * as authApi from '../../api/authApi.js'

function toSession(user) {
  return user
    ? { status: 'authenticated', user }
    : { status: 'unauthenticated', user: null }
}

// 앱 전체에서 useAuth()로 로그인 상태를 읽고 login·signup·logout을 호출
function AuthProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading', user: null })

  useEffect(() => {
    // 확인 중에 로그인을 마쳤다면 그 결과를 덮어쓰지 않음
    const settle = (user) =>
      setSession((prev) => (prev.status === 'loading' ? toSession(user) : prev))
    authApi
      .getCurrentUser()
      .then(settle)
      .catch(() => settle(null))
  }, [])

  const value = useMemo(
    () => ({
      session,
      login: async (input) => {
        const user = await authApi.login(input)
        setSession(toSession(user))
        return user
      },
      signup: async (input) => {
        const user = await authApi.signup(input)
        setSession(toSession(user))
        return user
      },
      logout: async () => {
        await authApi.logout()
        setSession(toSession(null))
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
