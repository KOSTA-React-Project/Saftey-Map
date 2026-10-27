import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import {
  createNote,
  getLocalToday,
  getNotesForAdmin,
  NOTE_STATUS,
} from '../api/notesApi.js'
import {
  ADMIN_STATUS_LABELS,
  filterAdminNotes,
  getModerationHistory,
} from '../utils/adminNotes.js'
import AdminNoteDialog from './AdminNoteDialog.jsx'
import { getAdminAccess } from '../services/adminAccess.js'
import styles from './AdminPage.module.css'

const PAGE_SIZE = 10

function AdminPage({ session = null }) {
  const access = getAdminAccess(session)
  const demoAvailable =
    (import.meta.env.DEV || import.meta.env.VITE_NOTES_DEMO_MODE === 'true') &&
    access === 'unconfigured'
  const canReview = access === 'allowed' || demoAvailable
  const [view, setView] = useState('notes')
  const [data, setData] = useState({ status: 'loading', notes: [], error: '' })
  const [refresh, setRefresh] = useState(0)
  const [filters, setFilters] = useState({
    query: '',
    status: NOTE_STATUS.PENDING,
    tag: '',
  })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [seeding, setSeeding] = useState(false)
  const selectedButtonRef = useRef(null)
  const headingRef = useRef(null)

  useEffect(() => {
    if (!canReview) return
    let active = true
    getNotesForAdmin(null)
      .then((notes) => {
        if (active) setData({ status: 'ready', notes, error: '' })
      })
      .catch((error) => {
        if (active)
          setData({ status: 'error', notes: [], error: error.message })
      })
    const reload = (event) => {
      if (event.key === 'safety-map:notes' || event.key === null) {
        setData({ status: 'loading', notes: [], error: '' })
        setSelected(null)
        setRefresh((value) => value + 1)
      }
    }
    window.addEventListener('storage', reload)
    return () => {
      active = false
      window.removeEventListener('storage', reload)
    }
  }, [canReview, refresh])

  function reload() {
    setData({ status: 'loading', notes: [], error: '' })
    setRefresh((value) => value + 1)
  }
  function filter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
    setPage(1)
  }
  function closeDetail() {
    setSelected(null)
    requestAnimationFrame(() => {
      const target = selectedButtonRef.current
      if (target?.isConnected) target.focus()
      else headingRef.current?.focus()
    })
  }
  function processed(id, status) {
    closeDetail()
    setMessage(
      `메모 #${id}을(를) ‘${ADMIN_STATUS_LABELS[status]}’ 처리했습니다.`,
    )
    reload()
  }
  async function seedExamples() {
    setSeeding(true)
    setMessage('')
    try {
      for (const [index, title, tag] of [
        [0, '역 앞 가로등이 꺼져 있어요', '조명 고장'],
        [1, '공원 입구 보도블록이 들떠요', '보행로 파손'],
        [2, '도서관 옆 임시 보행로 안내', '공사 구간'],
      ]) {
        await createNote({
          title: `[예시] ${title}`,
          tag,
          content:
            '관리자 승인 흐름을 확인하기 위한 가상 메모입니다. 실제 현장 관찰이 아닙니다.',
          observedDate: getLocalToday(),
          latitude: 37.5665 + index * 0.001,
          longitude: 126.978 + index * 0.001,
          locationName: '가상 예시 위치 · 실제 관찰 아님',
          agreed: true,
        })
      }
      setMessage(
        '예시 메모 3개를 승인 대기로 추가했습니다. 실제 사용자가 작성한 정보가 아닙니다.',
      )
    } catch (error) {
      setMessage(
        `예시 추가 실패: ${error.message} 이미 추가된 항목은 유지됩니다.`,
      )
    } finally {
      setSeeding(false)
      reload()
    }
  }

  const filtered = filterAdminNotes(data.notes, filters)
  const history = getModerationHistory(data.notes)
  const items = view === 'notes' ? filtered : history
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = items.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const tags = [...new Set(data.notes.map((note) => note.tag))].sort()
  const counts = Object.fromEntries(
    Object.keys(ADMIN_STATUS_LABELS).map((status) => [
      status,
      data.notes.filter((note) => note.status === status).length,
    ]),
  )

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.EXPLORE} className={styles.brand}>
          ⌖ 우리동네 안심노트
        </Link>
        <Link to={ROUTES.NOTES} className={styles.button}>
          공개 메모 보기 ↗
        </Link>
      </header>
      <div className={styles.container}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>ADMIN / NOTE REVIEW</p>
            <h1 ref={headingRef} tabIndex={-1}>
              메모 게시 관리
            </h1>
            <p>이웃의 관찰 기록이 공개되기 전, 내용을 확인해 주세요.</p>
          </div>
          <span className={styles.badge}>안심노트 관리</span>
        </div>
        <p className={styles.notice}>
          {demoAvailable
            ? import.meta.env.VITE_NOTES_DEMO_MODE === 'true'
              ? '샘플 DB 검증용 화면입니다. 가상 테스트 사용자로 작성·승인을 확인하며, 실제 회원 로그인과는 별개입니다.'
              : '로그인 연결 전 개발 화면입니다. 목록 조회와 처리는 서버 API를 사용하며 서버에서도 관리자 권한을 확인합니다.'
            : '목록 조회와 처리는 서버에서 관리자 권한을 확인합니다.'}
        </p>
        {(access !== 'unconfigured' && access !== 'allowed') ||
        (access === 'unconfigured' && !demoAvailable) ? (
          <section
            className={styles.panel}
            role={access === 'loading' ? 'status' : 'alert'}
          >
            <h2>
              {access === 'loading'
                ? '로그인 상태 확인 중…'
                : access === 'loginRequired'
                  ? '관리자 로그인이 필요합니다.'
                  : access === 'unconfigured'
                    ? '관리자 로그인 연동 준비 중입니다.'
                    : '관리자 권한이 없습니다.'}
            </h2>
            <p>인증 연결 후에는 서버에서도 관리자 권한을 확인해야 합니다.</p>
          </section>
        ) : (
          <>
            <section className={styles.stats} aria-label="메모 상태별 개수">
              {Object.entries(ADMIN_STATUS_LABELS).map(([status, label]) => (
                <button
                  key={status}
                  className={`${styles.stat} ${filters.status === status && view === 'notes' ? styles.selectedStat : ''}`}
                  onClick={() => {
                    setView('notes')
                    filter('status', status)
                  }}
                >
                  <span>{label}</span>
                  <strong>{counts[status]}</strong>
                </button>
              ))}
            </section>
            <div className={styles.toolbar}>
              <nav aria-label="관리 메뉴" className={styles.tabs}>
                <button
                  className={styles.button}
                  aria-pressed={view === 'notes'}
                  onClick={() => {
                    setView('notes')
                    setPage(1)
                  }}
                >
                  메모 관리
                </button>
                <button
                  className={styles.button}
                  aria-pressed={view === 'history'}
                  onClick={() => {
                    setView('history')
                    setPage(1)
                  }}
                >
                  처리 이력
                </button>
              </nav>
              <button className={styles.button} onClick={reload}>
                목록 새로고침
              </button>
            </div>
            {message && (
              <p className={styles.notice} role="status">
                {message}
              </p>
            )}
            {view === 'notes' && (
              <section className={styles.filters} aria-label="메모 검색과 필터">
                <label className={styles.field}>
                  제목·본문 검색
                  <input
                    type="search"
                    maxLength={80}
                    value={filters.query}
                    onChange={(event) => filter('query', event.target.value)}
                    placeholder="검색어 입력"
                  />
                </label>
                <label className={styles.field}>
                  승인 상태
                  <select
                    value={filters.status}
                    onChange={(event) => filter('status', event.target.value)}
                  >
                    <option value="">전체 상태</option>
                    {Object.entries(ADMIN_STATUS_LABELS).map(
                      ([status, label]) => (
                        <option key={status} value={status}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className={styles.field}>
                  태그
                  <select
                    value={filters.tag}
                    onChange={(event) => filter('tag', event.target.value)}
                  >
                    <option value="">전체 태그</option>
                    {tags.map((tag) => (
                      <option key={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.button}
                  onClick={() => {
                    setFilters({
                      query: '',
                      status: NOTE_STATUS.PENDING,
                      tag: '',
                    })
                    setPage(1)
                  }}
                >
                  검색 초기화
                </button>
              </section>
            )}
            {data.status === 'loading' && (
              <p className={styles.empty} role="status">
                메모를 불러오고 있어요…
              </p>
            )}
            {data.status === 'error' && (
              <div className={styles.empty} role="alert">
                <p>{data.error}</p>
                <button className={styles.button} onClick={reload}>
                  다시 시도
                </button>
              </div>
            )}
            {data.status === 'ready' && (
              <section className={styles.panel}>
                <div className={styles.listHeading}>
                  <h2>{view === 'notes' ? '메모 목록' : '관리자 처리 이력'}</h2>
                  <span>{items.length}건</span>
                </div>
                {!items.length ? (
                  <div className={styles.empty}>
                    {view === 'history'
                      ? '현재 DB 구조는 최근 상태와 처리 사유만 저장합니다. 각 메모의 상세에서 확인해 주세요.'
                      : data.notes.length
                        ? '검색 조건에 맞는 메모가 없습니다.'
                        : '제출된 메모가 없습니다. 사용자 화면에서 메모를 작성하거나 아래 예시를 추가해 주세요.'}
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <caption className={styles.caption}>
                        {view === 'notes'
                          ? '주민 메모 검토 목록'
                          : '게시 상태 변경 기록'}
                      </caption>
                      <thead>
                        {view === 'notes' ? (
                          <tr>
                            <th>제목</th>
                            <th>작성자</th>
                            <th>태그</th>
                            <th>관찰일</th>
                            <th>작성 시각</th>
                            <th>상태</th>
                          </tr>
                        ) : (
                          <tr>
                            <th>메모</th>
                            <th>처리</th>
                            <th>사유</th>
                            <th>처리 관리자</th>
                            <th>처리 시각</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {visible.map((item) =>
                          view === 'notes' ? (
                            <tr key={item.id}>
                              <td>
                                <button
                                  className={styles.titleButton}
                                  onClick={(event) => {
                                    selectedButtonRef.current =
                                      event.currentTarget
                                    setSelected(item)
                                  }}
                                >
                                  {item.title}
                                </button>
                              </td>
                              <td>
                                {item.authorName ||
                                  (item.authorId != null
                                    ? `회원 #${item.authorId}`
                                    : '작성자 미연결')}
                              </td>
                              <td>{item.tag}</td>
                              <td>{item.observedDate}</td>
                              <td>
                                {new Date(item.createdAt).toLocaleString(
                                  'ko-KR',
                                )}
                              </td>
                              <td>
                                <span
                                  className={`${styles.badge} ${styles[item.status]}`}
                                >
                                  {ADMIN_STATUS_LABELS[item.status] ||
                                    item.status}
                                </span>
                              </td>
                            </tr>
                          ) : (
                            <tr key={item.id}>
                              <td>{item.title}</td>
                              <td>
                                {ADMIN_STATUS_LABELS[item.from]} →{' '}
                                {ADMIN_STATUS_LABELS[item.to]}
                              </td>
                              <td>{item.reason || '승인 사유 미입력'}</td>
                              <td>{item.actor}</td>
                              <td>
                                {new Date(item.processedAt).toLocaleString(
                                  'ko-KR',
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className={styles.pagination}>
                  <button
                    className={styles.button}
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    이전
                  </button>
                  <span>
                    {currentPage} / {totalPages} 페이지
                  </span>
                  <button
                    className={styles.button}
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    다음
                  </button>
                </div>
              </section>
            )}
            <section className={styles.demoTools}>
              <div>
                <h2>검토할 메모가 없다면</h2>
                <p>
                  ‘예시’ 표시가 붙은 승인 대기 메모 3개를 추가합니다. 기존
                  메모를 지우거나 변경하지 않습니다.
                </p>
              </div>
              <button
                className={styles.button}
                disabled={seeding || data.status !== 'ready'}
                onClick={seedExamples}
              >
                {seeding ? '예시 추가 중…' : '검토용 예시 메모 3개 추가'}
              </button>
            </section>
          </>
        )}
      </div>
      {canReview && selected && (
        <AdminNoteDialog
          key={selected.id}
          note={selected}
          onClose={closeDetail}
          onProcessed={processed}
        />
      )}
    </main>
  )
}

export default AdminPage
