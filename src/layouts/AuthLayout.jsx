import { Outlet } from 'react-router'
import AuthIllustration from '../components/auth/AuthIllustration.jsx'
import styles from './AuthLayout.module.css'

// 로그인·회원가입 공통 뼈대 — 왼쪽 소개와 그림, 오른쪽 폼(페이지)과 안내
function AuthLayout() {
  return (
    <div className={styles.authLayout}>
      <section className={styles.intro}>
        <p className={styles.headline}>
          동네를 고르는 기준에
          <br />
          현장의 이야기를 더해요.
        </p>
        <p className={styles.lead}>공공정보와 주민의 관찰을 함께 살펴보세요.</p>
        <AuthIllustration className={styles.map} />
      </section>

      <div className={styles.formArea}>
        <Outlet />
        <div className={styles.notice}>
          <p>지도 탐색과 공개 메모 조회는 로그인 없이 가능해요.</p>
          <p>메모 작성·수정·삭제에는 로그인이 필요해요.</p>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
