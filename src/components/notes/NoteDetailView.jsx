import { useEffect, useState } from 'react'
import { useMapCenter } from '../../hooks/useMap.js'
import { getApprovedNote } from '../../api/notesApi.js'
import styles from './NoteDetailView.module.css'

function formatDate(iso) {
  return iso.slice(0, 10).replaceAll('-', '.')
}

// 안심노트 상세 내용 — 승인된 노트만 열린다. 작성자 이름은 보여주지 않음
// 지도 화면 안에서 쓰면 노트 위치로 지도 중심을 옮긴다
function NoteDetailView({ id }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true
    getApprovedNote(id)
      .then((note) => active && setResult({ id, note }))
      .catch((e) => active && setResult({ id, error: e.message }))
    return () => {
      active = false
    }
  }, [id])

  // 이전 노트의 결과가 남아 있으면 불러오는 중으로 본다
  const current = result?.id === id ? result : null
  const note = current?.note

  useMapCenter(note && { lat: note.latitude, lng: note.longitude })

  if (!current) return <p className={styles.status}>불러오고 있어요…</p>
  if (current.error) return <p className={styles.status}>{current.error}</p>

  return (
    <>
      <span className={styles.chip}>주민 관찰 기록</span>
      <p className={styles.tag}>{note.tag}</p>
      <h2 className={styles.title}>{note.title}</h2>
      <p className={styles.meta}>작성 {formatDate(note.createdAt)}</p>

      <dl className={styles.info}>
        <dt>관찰한 날</dt>
        <dd>{formatDate(note.observedDate)}</dd>
        <dt>관찰한 곳</dt>
        <dd>{note.locationName || '주소를 확인할 수 없는 위치'}</dd>
      </dl>

      <p className={styles.content}>{note.content}</p>

      <p className={styles.notice}>
        개인의 특정 시점 관찰입니다.
        <br />
        현재 상황과 다를 수 있으며 공식 확인 정보가 아닙니다.
      </p>
    </>
  )
}

export default NoteDetailView
