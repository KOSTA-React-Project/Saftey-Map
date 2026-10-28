import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import { getNotesForAdmin, NOTE_STATUS } from '../api/notesApi.js'
import { ADMIN_STATUS_LABELS } from '../utils/adminNotes.js'
import AdminNoteDialog from './AdminNoteDialog.jsx'
import { getAdminAccess } from '../services/adminAccess.js'
import styles from './AdminPage.module.css'
import { useAuth } from '../hooks/useAuth.js'

const INITIAL_FILTERS = {
  query: '',
  status: NOTE_STATUS.PENDING,
  tag: '',
  page: 1,
  pageSize: 10,
}
const INITIAL_DATA = {
  status: 'loading',
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
  counts: {},
  error: '',
  errorStatus: null,
}

function AdminPage() {
  const { session } = useAuth()
  const access = getAdminAccess(session)
  // 화면에서는 로그인 상태를 확인하고, 실제 권한은 서버에서도 검사한다.
  const canRequest = access === 'allowed'
  const [data, setData] = useState(INITIAL_DATA)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const selectedButtonRef = useRef(null)
  const headingRef = useRef(null)

  useEffect(() => {
    if (!canRequest) return
    const controller = new AbortController()
    let active = true
    // 입력 중에는 요청을 모으고, 이전 요청의 늦은 응답은 반영하지 않는다.
    const timer = setTimeout(() => {
      getNotesForAdmin(filters, { signal: controller.signal })
        .then((result) => {
          if (active)
            setData({
              ...result,
              status: 'ready',
              error: '',
              errorStatus: null,
            })
        })
        .catch((error) => {
          if (active && error.name !== 'AbortError') {
            setData({
              ...INITIAL_DATA,
              status: 'error',
              error: error.message,
              errorStatus: error.status,
            })
          }
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [canRequest, filters, refresh])

  function beginLoading() {
    setData((previous) => ({
      ...previous,
      status: 'loading',
      error: '',
      errorStatus: null,
    }))
    setSelected(null)
  }
  function reload() {
    beginLoading()
    setRefresh((value) => value + 1)
  }
  function filter(name, value) {
    beginLoading()
    setMessage('')
    setFilters((previous) => ({
      ...previous,
      [name]: value,
      page: name === 'page' ? value : 1,
    }))
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
      `메모 #${id}을(를) ‘${ADMIN_STATUS_LABELS[status]}’ 상태로 처리했습니다.`,
    )
    reload()
  }

  const loading = data.status === 'loading'
  const authError = data.errorStatus === 401 || data.errorStatus === 403

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
          <span className={styles.badge}>
            {data.status === 'ready' ? '서버 목록 조회 완료' : '서버 API 사용'}
          </span>
        </div>
        <p className={styles.notice}>
          목록 조회와 게시 처리는 서버 API를 사용합니다. 서버가 관리자 권한을
          확인한 요청만 처리합니다.
        </p>
        {!canRequest ? (
          <section
            className={styles.panel}
            role={access === 'loading' ? 'status' : 'alert'}
          >
            <h2>
              {access === 'loading'
                ? '로그인 상태 확인 중…'
                : access === 'loginRequired'
                  ? '관리자 로그인이 필요합니다.'
                  : '관리자 권한이 없습니다.'}
            </h2>
          </section>
        ) : (
          <>
            <section
              className={styles.stats}
              aria-label="전체 메모 상태별 개수"
            >
              {Object.entries(ADMIN_STATUS_LABELS).map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  className={`${styles.stat} ${filters.status === status ? styles.selectedStat : ''}`}
                  aria-pressed={filters.status === status}
                  onClick={() => filter('status', status)}
                >
                  <span>{label}</span>
                  <strong>
                    {data.status === 'ready' ? (data.counts[status] ?? 0) : '—'}
                  </strong>
                </button>
              ))}
            </section>
            <div className={styles.toolbar}>
              <p className={styles.muted}>
                상단 개수는 전체 메모 기준입니다. 목록은 아래 검색 조건을
                적용합니다.
              </p>
              <button type="button" className={styles.button} onClick={reload}>
                목록 새로고침
              </button>
            </div>
            {message && (
              <p className={styles.notice} role="status">
                {message}
              </p>
            )}
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
                태그 · 정확히 일치
                <input
                  maxLength={20}
                  value={filters.tag}
                  onChange={(event) => filter('tag', event.target.value)}
                  placeholder="예: 조명 고장"
                />
              </label>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  beginLoading()
                  setFilters({ ...INITIAL_FILTERS })
                  setMessage('')
                }}
              >
                검색 초기화
              </button>
            </section>
            {loading && (
              <p className={styles.empty} role="status">
                메모를 불러오고 있어요…
              </p>
            )}
            {data.status === 'error' && (
              <section className={styles.panel} role="alert">
                <h2>
                  {data.errorStatus === 401
                    ? '관리자 인증이 필요합니다.'
                    : data.errorStatus === 403
                      ? '관리자 권한이 없습니다.'
                      : '목록을 불러오지 못했습니다.'}
                </h2>
                <p>{data.error}</p>
                {authError && (
                  <p>
                    로그인·권한 연결 후 다시 확인해 주세요. 예시 데이터로
                    대체하지 않습니다.
                  </p>
                )}
                <button
                  type="button"
                  className={styles.button}
                  onClick={reload}
                >
                  다시 시도
                </button>
              </section>
            )}
            {data.status === 'ready' && (
              <section className={styles.panel}>
                <div className={styles.listHeading}>
                  <h2>메모 목록</h2>
                  <span>검색 결과 {data.total}건</span>
                </div>
                {!data.items.length ? (
                  <p className={styles.empty}>
                    현재 검색 조건에 맞는 메모가 없습니다.
                  </p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <caption className={styles.caption}>
                        주민 메모 검토 목록 · 페이지당 {filters.pageSize}개
                      </caption>
                      <thead>
                        <tr>
                          <th>제목</th>
                          <th>작성자</th>
                          <th>태그</th>
                          <th>관찰일</th>
                          <th>작성 시각</th>
                          <th>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => (
                          <tr key={item.id}>
                            <td data-label="제목">
                              <button
                                type="button"
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
                            <td data-label="작성자">
                              {item.authorName ||
                                (item.authorId != null
                                  ? `회원 #${item.authorId}`
                                  : '작성자 정보 없음')}
                            </td>
                            <td data-label="태그">{item.tag}</td>
                            <td data-label="관찰일">{item.observedDate}</td>
                            <td data-label="작성 시각">
                              {new Date(item.createdAt).toLocaleString('ko-KR')}
                            </td>
                            <td data-label="상태">
                              <span
                                className={`${styles.badge} ${styles[item.status]}`}
                              >
                                {ADMIN_STATUS_LABELS[item.status] ||
                                  item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={data.page <= 1}
                    onClick={() => filter('page', data.page - 1)}
                  >
                    이전
                  </button>
                  <span aria-live="polite">
                    {data.page} / {data.totalPages} 페이지
                  </span>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={data.page >= data.totalPages}
                    onClick={() => filter('page', data.page + 1)}
                  >
                    다음
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {canRequest && selected && (
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
