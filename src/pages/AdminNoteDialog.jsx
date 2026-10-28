import { useEffect, useRef, useState } from 'react'
import MapView from '../components/map/MapView.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import { NOTE_STATUS, updateNoteStatus } from '../api/notesApi.js'
import { ADMIN_STATUS_LABELS } from '../utils/adminNotes.js'
import styles from './AdminPage.module.css'

function AdminNoteDialog({ note, onClose, onProcessed }) {
  const dialogRef = useRef(null)
  const aliveRef = useRef(true)
  const [reason, setReason] = useState('')
  const [action, setAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    aliveRef.current = true
    const dialog = dialogRef.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      aliveRef.current = false
      dialog.close()
      document.body.style.overflow = overflow
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!action || saving) return
    if (action !== NOTE_STATUS.APPROVED && !reason.trim()) {
      setError('반려·숨김 사유를 입력해 주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateNoteStatus(note.id, action, {
        reason,
        expectedStatus: note.status,
      })
      if (aliveRef.current) onProcessed(note.id, action)
    } catch (err) {
      if (aliveRef.current) {
        setError(err.message)
        setSaving(false)
      }
    }
  }
  const position = { lat: note.latitude, lng: note.longitude }
  const close = () => {
    if (!saving) onClose()
  }
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="admin-note-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className={styles.dialogHeading}>
        <div>
          <span className={`${styles.badge} ${styles[note.status]}`}>
            {ADMIN_STATUS_LABELS[note.status]}
          </span>
          <h2 id="admin-note-title">메모 검토</h2>
        </div>
        <button
          type="button"
          className={styles.button}
          onClick={close}
          disabled={saving}
          autoFocus
        >
          닫기
        </button>
      </div>
      <h3 className={styles.noteTitle}>{note.title}</h3>
      <dl className={styles.metadata}>
        <div>
          <dt>작성자 이메일</dt>
          <dd>{note.authorEmail || '정보 없음'}</dd>
        </div>
        <div>
          <dt>작성자 닉네임</dt>
          <dd>{note.authorNickname || '정보 없음'}</dd>
        </div>
        <div>
          <dt>태그</dt>
          <dd>{note.tag}</dd>
        </div>
        <div>
          <dt>관찰일</dt>
          <dd>{note.observedDate}</dd>
        </div>
        <div>
          <dt>작성 시각</dt>
          <dd>{new Date(note.createdAt).toLocaleString('ko-KR')}</dd>
        </div>
        <div>
          <dt>위치</dt>
          <dd>
            {note.locationName || '주소 정보 없음'}
            <br />
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </dd>
        </div>
      </dl>
      <p className={styles.noteBody}>{note.content}</p>
      <MapView
        center={position}
        level={4}
        interactive={false}
        showControls={false}
        className={styles.detailMap}
      >
        <MapMarker type="note" position={position} />
      </MapView>
      <p className={styles.muted}>
        개인의 특정 시점 관찰입니다. 게시 승인은 내용의 사실이나 지역의 안전을
        보증하지 않습니다.
      </p>
      <form onSubmit={submit} className={styles.reviewForm}>
        <fieldset disabled={saving} className={styles.actionChoices}>
          <legend>처리 선택</legend>
          {note.status === NOTE_STATUS.PENDING && (
            <>
              <button
                type="button"
                className={styles.button}
                aria-pressed={action === NOTE_STATUS.APPROVED}
                onClick={() => {
                  setAction(NOTE_STATUS.APPROVED)
                  setError('')
                }}
              >
                게시 승인
              </button>
              <button
                type="button"
                className={styles.button}
                aria-pressed={action === NOTE_STATUS.REJECTED}
                onClick={() => {
                  setAction(NOTE_STATUS.REJECTED)
                  setError('')
                }}
              >
                반려
              </button>
            </>
          )}
          {note.status === NOTE_STATUS.APPROVED && (
            <button
              type="button"
              className={styles.button}
              aria-pressed={action === NOTE_STATUS.HIDDEN}
              onClick={() => setAction(NOTE_STATUS.HIDDEN)}
            >
              게시 숨김
            </button>
          )}
          {note.status === NOTE_STATUS.HIDDEN && (
            <button
              type="button"
              className={styles.button}
              aria-pressed={action === NOTE_STATUS.APPROVED}
              onClick={() => setAction(NOTE_STATUS.APPROVED)}
            >
              다시 공개
            </button>
          )}
          {note.status === NOTE_STATUS.REJECTED && (
            <p>
              반려된 메모입니다. 사용자 수정·재승인 기능은 제공하지 않습니다.
            </p>
          )}
        </fieldset>
        {note.status !== NOTE_STATUS.REJECTED && (
          <>
            <label className={styles.field} htmlFor="moderation-reason">
              처리 사유 · 반려·숨김 필수 / 최대 500자
              <textarea
                id="moderation-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={saving}
                aria-describedby={error ? 'moderation-error' : undefined}
                aria-invalid={Boolean(error)}
              />
            </label>
            {action && (
              <p className={styles.notice}>
                확정하면 ‘{ADMIN_STATUS_LABELS[action]}’ 상태가 됩니다.{' '}
                {action === NOTE_STATUS.APPROVED
                  ? '공개 지도와 상세에서 볼 수 있습니다.'
                  : '공개 지도와 상세에서 제외됩니다.'}
              </p>
            )}
            <button
              type="submit"
              className={styles.primary}
              disabled={!action || saving}
            >
              {saving ? '처리 중…' : '선택한 처리 확정'}
            </button>
          </>
        )}
        {error && (
          <p id="moderation-error" role="alert" className={styles.notice}>
            처리 실패 · {error}
          </p>
        )}
      </form>
      <details className={styles.historyDetails}>
        <summary>최근 처리 상태와 사유</summary>
        <p>{ADMIN_STATUS_LABELS[note.status]}</p>
        <p>{note.moderationReason || '등록된 처리 사유가 없습니다.'}</p>
        {note.updatedAt && (
          <small>{new Date(note.updatedAt).toLocaleString('ko-KR')}</small>
        )}
      </details>
    </dialog>
  )
}

export default AdminNoteDialog
