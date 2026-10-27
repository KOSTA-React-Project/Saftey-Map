import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'
import { validateLogin } from '../api/authApi.js'
import styles from './LoginPage.module.css'

const EMPTY_FORM = { email: '', password: '' }

// 로그인 — 성공하면 원래 보던 화면(state.from)으로, 없으면 지도 탐색으로 이동
function LoginPage() {
  const location = useLocation()
  const { session, login } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  if (session.status === 'authenticated') {
    // 방금 로그인한 관리자는 항상 관리자 화면으로
    const target =
      submitting && session.user.role === 'ADMIN'
        ? ROUTES.ADMIN
        : (location.state?.from ?? ROUTES.EXPLORE)
    return <Navigate to={target} replace />
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const validationErrors = validateLogin(form)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    setSubmitting(true)
    try {
      await login(form)
    } catch (err) {
      setErrors([err.message])
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h1 className={styles.title}>다시 만나 반가워요</h1>
      <p className={styles.description}>안심노트를 남기려면 로그인해주세요.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>이메일</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            placeholder="이메일 입력"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>비밀번호</span>
          <input
            className={styles.input}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            placeholder="비밀번호 입력"
          />
        </label>

        {errors.length > 0 && (
          <ul className={styles.errors} role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={submitting}
          >
            {submitting ? '로그인 중…' : '로그인'}
          </button>
          <Link
            to={ROUTES.SIGNUP}
            state={location.state}
            className={styles.secondaryButton}
          >
            회원가입
          </Link>
          <Link to={ROUTES.EXPLORE} className={styles.secondaryButton}>
            로그인 없이 지도 둘러보기
          </Link>
        </div>
      </form>
    </section>
  )
}

export default LoginPage
