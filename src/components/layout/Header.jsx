import { Link, NavLink } from 'react-router'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { to: ROUTES.EXPLORE, label: '지도 탐색', end: true },
  { to: ROUTES.COMPARE, label: '두 지역 비교' },
  { to: ROUTES.NOTES, label: '안심노트' },
]

function Header() {
  const { session, logout } = useAuth()

  return (
    <header className={styles.header}>
      <Link to={ROUTES.EXPLORE} className={styles.logo}>
        <svg className={styles.logoIcon} viewBox="0 0 24 30" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.3 0 11.8 0 20.6 12 30 12 30s12-9.4 12-18.2C24 5.3 18.6 0 12 0Z" />
          <circle cx="12" cy="11.5" r="4.5" fill="var(--color-white)" />
        </svg>
        우리동네 안심지도
      </Link>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.actions}>
        <Link to={ROUTES.POLICY} className={styles.actionButton}>
          이용 안내
        </Link>
        {/* 로그인 상태를 확인하는 동안은 버튼을 비워 깜빡임을 막음 */}
        {session.status === 'authenticated' && (
          <>
            <span className={styles.userName}>{session.user.nickname}님</span>
            <button
              type="button"
              className={styles.actionButton}
              onClick={logout}
            >
              로그아웃
            </button>
          </>
        )}
        {session.status === 'unauthenticated' && (
          <Link to={ROUTES.LOGIN} className={styles.actionButton}>
            로그인 / 회원가입
          </Link>
        )}
      </div>
    </header>
  )
}

export default Header
