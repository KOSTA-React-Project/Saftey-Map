import { useId, useState } from 'react'
import { useLocation } from 'react-router'
import styles from './Sidebar.module.css'

// PC는 기존 사이드바, 모바일은 버튼으로 접고 펼치는 지도 하단 패널.
function Sidebar({ children, footer, initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const panelId = useId()
  const { pathname } = useLocation()
  const title = pathname.startsWith('/compare')
    ? '두 지역 비교'
    : pathname.startsWith('/notes')
      ? '안심노트'
      : '지도 탐색'

  return (
    <aside
      className={styles.sidebar}
      data-expanded={expanded}
      aria-label={`${title} 패널`}
    >
      <div className={styles.mobileToolbar}>
        <strong>{title}</strong>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '접기 ∨' : '펼치기 ∧'}
        </button>
      </div>
      <p className={styles.collapsedHint}>
        펼치면 검색·설정과 내용을 확인할 수 있어요.
      </p>
      <div id={panelId} className={styles.panelContent}>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </aside>
  )
}

export default Sidebar
