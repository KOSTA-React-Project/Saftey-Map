import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'
import { NICKNAME_MAX, PASSWORD_MAX, validateSignup } from '../api/authApi.js'
import styles from './SignupPage.module.css'

const EMPTY_FORM = {
  email: '',
  nickname: '',
  password: '',
  passwordConfirm: '',
  agreed: false,
}

// 회원가입 — 가입하면 바로 로그인되고 원래 보던 화면(state.from)으로 이동
function SignupPage() {
  const location = useLocation()
  const { session, signup } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  if (session.status === 'authenticated') {
    return <Navigate to={location.state?.from ?? ROUTES.EXPLORE} replace />
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const validationErrors = validateSignup(form)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    setSubmitting(true)
    try {
      await signup(form)
    } catch (err) {
      setErrors([err.message])
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h1 className={styles.title}>회원가입</h1>
      <p className={styles.description}>이메일로 간단하게 시작하세요.</p>

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
            placeholder="you@example.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>닉네임</span>
          <input
            className={styles.input}
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            placeholder={`2~${NICKNAME_MAX}자 입력`}
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
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            placeholder="8자 이상 입력"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>비밀번호 확인</span>
          <input
            className={styles.input}
            type="password"
            name="passwordConfirm"
            value={form.passwordConfirm}
            onChange={handleChange}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력"
          />
        </label>

        <label className={styles.check}>
          <input
            type="checkbox"
            name="agreed"
            checked={form.agreed}
            onChange={handleChange}
          />
          [필수] 이용약관 및 개인정보 처리에 동의합니다.
        </label>

        {errors.length > 0 && (
          <ul className={styles.errors} role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
        >
          {submitting ? '가입 중…' : '회원가입'}
        </button>
      </form>

      <p className={styles.switch}>
        이미 계정이 있나요?{' '}
        <Link to={ROUTES.LOGIN} state={location.state} className={styles.link}>
          로그인
        </Link>
      </p>
    </section>
  )
}

export default SignupPage
