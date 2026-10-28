import { Link } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import Sidebar from '../components/layout/Sidebar.jsx'
import NoteSpotMarkers from '../components/notes/NoteSpotMarkers.jsx'
import NoteSpotPanel from '../components/notes/NoteSpotPanel.jsx'
import { useApprovedNotes } from '../hooks/useApprovedNotes.js'
import { useNoteSpots } from '../hooks/useNoteSpots.js'
import styles from './NotePage.module.css'

// 안심노트 첫 화면 — 사이드바에 설명, 지도에 승인된 노트 표시
// 마커를 누르면 사이드바에서 그 위치의 노트 목록·상세를 보여줌
function NotePage() {
  const { notes } = useApprovedNotes()
  const noteSpots = useNoteSpots(notes)

  return (
    <>
      <Sidebar
        key={noteSpots.isOpen ? 'detail' : 'overview'}
        initialExpanded={noteSpots.isOpen}
        footer={
          <Link to={`${ROUTES.NOTES}/new`} className={styles.primaryButton}>
            작성하기
          </Link>
        }
      >
        {noteSpots.isOpen ? (
          <NoteSpotPanel
            spot={noteSpots.spot}
            noteId={noteSpots.noteId}
            onOpenNote={noteSpots.openNote}
            onBack={noteSpots.backToList}
            onClose={noteSpots.close}
          />
        ) : (
          <>
            <p className={styles.eyebrow}>안심노트</p>
            <h2 className={styles.title}>직접 본 동네 이야기를 나눠요</h2>
            <ul className={styles.points}>
              <li>
                안심노트는 주민이 직접 관찰한 기록이에요. 공공데이터나 안전
                점수와는 관계가 없어요.
              </li>
              <li>
                작성한 노트는 관리자 승인 후 지도에 공개돼요. 승인이 내용의
                사실을 보증하지는 않아요.
              </li>
              <li>지도의 + 표시를 누르면 공개된 노트를 볼 수 있어요.</li>
            </ul>
          </>
        )}
      </Sidebar>
      <NoteSpotMarkers spots={noteSpots.spots} onSelect={noteSpots.openSpot} />
    </>
  )
}

export default NotePage
