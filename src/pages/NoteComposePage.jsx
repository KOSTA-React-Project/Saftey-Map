import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'
import MapView from '../components/map/MapView.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import PlaceSearchBox from '../components/search/PlaceSearchBox.jsx'
import { useMapCenter } from '../hooks/useMap.js'
import { useLocationPicker } from '../hooks/useLocationPicker.js'
import {
  CONTENT_MAX,
  TAG_MAX,
  TITLE_MAX,
  createNote,
  getApprovedNotes,
  getLocalToday,
  validateNote,
} from '../api/notesApi.js'
import styles from './NoteComposePage.module.css'

const COMPOSE_PATH = `${ROUTES.NOTES}/new`

const EMPTY_FORM = {
  title: '',
  tag: '',
  observedDate: '',
  content: '',
  agreed: false,
}

// MapView 안에서 검색한 위치로 지도 중심을 옮김
function CenterOn({ position }) {
  useMapCenter(position)
  return null
}

// 안심노트 작성 — 왼쪽 폼, 오른쪽 지도
// 위치 칸에서 검색하거나 지도를 누르면 바로 위치가 정해짐 (좌표는 저장용, 화면엔 주소만)
function NoteComposePage() {
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [approvedNotes, setApprovedNotes] = useState([])
  const [searched, setSearched] = useState(null)
  const { location, isLocating, pickFromMap, searchBoxProps } =
    useLocationPicker({
      onSearchSelect: ({ lat, lng }) => setSearched({ lat, lng }),
    })
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 로그인하지 않았으면 안내창을 띄우고 로그인 화면으로. 로그인하면 state.from(작성 화면)으로 돌아옴
  // 개발 모드(StrictMode)에서 effect가 두 번 실행돼도 안내창은 한 번만 뜨게 ref로 막음
  const notifiedRef = useRef(false)
  useEffect(() => {
    if (session.status !== 'unauthenticated' || notifiedRef.current) return
    notifiedRef.current = true
    window.alert('안심노트는 로그인 이후 작성하실 수 있습니다.')
    navigate(ROUTES.LOGIN, { replace: true, state: { from: COMPOSE_PATH } })
  }, [session.status, navigate])

  useEffect(() => {
    getApprovedNotes()
      .then(setApprovedNotes)
      .catch(() => setApprovedNotes([]))
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (isLocating) {
      setErrors(['위치 주소를 확인하고 있어요. 잠시 후 다시 등록해주세요.'])
      return
    }
    const input = {
      ...form,
      latitude: location?.lat,
      longitude: location?.lng,
      locationName: location?.address ?? '',
    }
    const validationErrors = validateNote(input)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    setSubmitting(true)
    try {
      await createNote(input)
      setSubmitted(true)
    } catch (err) {
      // 로그인이 만료됐으면 로그아웃 상태로 바꿔 아래에서 로그인 화면으로 이동
      // 로그아웃 요청마저 실패하면 페이지를 새로 열어 로그인 상태를 다시 확인
      if (err.status === 401) {
        try {
          await logout()
        } catch {
          window.location.assign(ROUTES.LOGIN)
          return
        }
      }
      setErrors([err.message])
    } finally {
      setSubmitting(false)
    }
  }

  // 로그인 확인 중이거나 로그인하지 않았으면 아무것도 그리지 않음
  // (작성 화면이 잠깐 보였다 사라지지 않게, 로그인 화면 이동은 위 useEffect에서)
  if (session.status !== 'authenticated') return null

  if (submitted) {
    return (
      <section className={styles.done}>
        <h1 className={styles.title}>안심노트가 제출되었어요</h1>
        <p className={styles.description}>
          관리자 검토 후 승인되면 지도에 공개돼요.
        </p>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => navigate(ROUTES.NOTES)}
        >
          안심노트로 돌아가기
        </button>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>COMMUNITY NOTE</p>
        <h1 className={styles.title}>직접 본 동네 이야기를 남겨주세요</h1>
        <p className={styles.description}>
          정확한 장소와 관찰 날짜를 적으면 다른 사람에게 도움이 돼요.
        </p>
      </header>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              제목 * · 최대 {TITLE_MAX}자
            </span>
            <input
              className={styles.input}
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={TITLE_MAX}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>태그 * · 최대 {TAG_MAX}자</span>
            <input
              className={styles.input}
              name="tag"
              value={form.tag}
              onChange={handleChange}
              maxLength={TAG_MAX}
              placeholder="예: 조명 고장, 보행로 파손"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>관찰 날짜 *</span>
            <input
              className={styles.input}
              type="date"
              name="observedDate"
              value={form.observedDate}
              onChange={handleChange}
              max={getLocalToday()}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>위치 *</span>
            <PlaceSearchBox {...searchBoxProps} selectFirst />
            <span className={styles.hint}>
              지도를 눌러도 위치를 정할 수 있어요.
            </span>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              내용 * · 최대 {CONTENT_MAX.toLocaleString()}자
            </span>
            <textarea
              className={styles.textarea}
              name="content"
              value={form.content}
              onChange={handleChange}
              maxLength={CONTENT_MAX}
              placeholder="직접 관찰한 상황과 시간을 적어주세요."
            />
            <span className={styles.charCount}>
              {form.content.length} / {CONTENT_MAX.toLocaleString()}
            </span>
          </label>

          <div className={styles.notice}>
            <p>
              개인을 식별할 수 있는 정보나 확인하지 않은 추측은 적지 말아주세요.
            </p>
            <p>공개 메모는 범죄 신고 접수나 긴급 대응 기능이 아닙니다.</p>
          </div>

          <label className={styles.check}>
            <input
              type="checkbox"
              name="agreed"
              checked={form.agreed}
              onChange={handleChange}
            />
            작성한 메모가 모든 이용자에게 공개됨을 확인했어요. *
          </label>

          {errors.length > 0 && (
            <ul className={styles.errors} role="alert">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(ROUTES.NOTES)}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting || isLocating}
            >
              {submitting ? '등록 중…' : '공개 안심노트 등록'}
            </button>
          </div>
        </form>

        <div className={styles.side}>
          <MapView className={styles.map} onClick={pickFromMap}>
            {approvedNotes.map((note) => (
              <MapMarker
                key={note.id}
                type="note"
                position={{ lat: note.latitude, lng: note.longitude }}
              />
            ))}
            <MapMarker type="new" position={location} />
            <CenterOn position={searched} />
          </MapView>
        </div>
      </div>
    </section>
  )
}

export default NoteComposePage
