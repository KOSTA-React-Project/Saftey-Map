import styles from './Sidebar.module.css'

// footer: 하단 고정 영역 (예: 비교하기 버튼). 본문만 스크롤됨
function Sidebar({ children, footer }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </aside>
  )
}

export default Sidebar
