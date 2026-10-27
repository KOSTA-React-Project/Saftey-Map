import NoteDetailView from './NoteDetailView.jsx'
import styles from './NoteSpotPanel.module.css'

// 지도에서 고른 지점의 안심노트 — 여러 개면 목록, 하나를 고르면 상세
function NoteSpotPanel({ spot, noteId, onOpenNote, onBack, onClose }) {
  const hasList = spot != null && spot.notes.length > 1

  return (
    <section aria-label="선택한 위치의 안심노트">
      <div className={styles.head}>
        {noteId && hasList ? (
          <button type="button" className={styles.back} onClick={onBack}>
            ← 목록으로
          </button>
        ) : (
          <p className={styles.label}>
            {noteId ? '안심노트 상세' : '안심노트'}
          </p>
        )}
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {noteId ? (
        <NoteDetailView id={noteId} />
      ) : spot ? (
        <>
          <p className={styles.count}>
            이 위치의 안심노트 {spot.notes.length}개
          </p>
          <ul className={styles.list}>
            {spot.notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => onOpenNote(note.id)}
                >
                  <span className={styles.itemTag}>{note.tag}</span>
                  <span className={styles.itemTitle}>{note.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.empty}>이 위치의 안심노트를 찾을 수 없어요.</p>
      )}
    </section>
  )
}

export default NoteSpotPanel
