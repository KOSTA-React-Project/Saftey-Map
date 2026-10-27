import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import Sidebar from '../components/layout/Sidebar.jsx'
import NoteDetailView from '../components/notes/NoteDetailView.jsx'
import NoteSpotMarkers from '../components/notes/NoteSpotMarkers.jsx'
import { useApprovedNotes } from '../hooks/useApprovedNotes.js'
import { groupNotesBySpot, spotSearchParams } from '../hooks/useNoteSpots.js'
import styles from './NoteDetailPage.module.css'

// 안심노트 상세 (주소로 바로 들어온 경우) — 내용은 공용 NoteDetailView 사용
// 지도 마커를 누르면 안심노트 화면의 목록·상세로 이동
function NoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes } = useApprovedNotes()
  const spots = useMemo(() => groupNotesBySpot(notes), [notes])

  return (
    <>
      <Sidebar
        footer={
          <Link to={`${ROUTES.NOTES}/new`} className={styles.primaryButton}>
            작성하기
          </Link>
        }
      >
        <div className={styles.head}>
          <p className={styles.label}>안심노트 상세</p>
          <Link to={ROUTES.NOTES} className={styles.close} aria-label="닫기">
            ✕
          </Link>
        </div>
        <NoteDetailView id={id} />
      </Sidebar>
      <NoteSpotMarkers
        spots={spots}
        onSelect={(spot) =>
          navigate({
            pathname: ROUTES.NOTES,
            search: `?${new URLSearchParams(spotSearchParams(spot))}`,
          })
        }
      />
    </>
  )
}

export default NoteDetailPage
