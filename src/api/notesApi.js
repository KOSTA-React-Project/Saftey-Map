// 안심노트 API — 서버 구현 전 임시(mock) 버전. localStorage에 저장한다.
// 함수 이름과 규칙은 기획의 API 설계에 맞춰 두었다. 서버가 생기면 각 함수 안을
// fetch 호출로 바꾸면 되고, 화면 코드는 그대로 쓸 수 있다.
//   POST  /api/notes                     → createNote
//   GET   /api/notes                     → getApprovedNotes
//   GET   /api/notes/:id                 → getApprovedNote
//   GET   /api/admin/notes?status=...    → getNotesForAdmin
//   PATCH /api/admin/notes/:id/status    → updateNoteStatus
// 로그인 기능은 팀원 담당이라 아직 넣지 않았다. 로그인이 완성되면 서버에서
//   - createNote: 세션의 회원 ID를 authorId로 저장, 비로그인 차단
//   - 관리자용 두 함수: ADMIN 권한 검사
// 를 추가한다. 관리자용 함수는 관리자 화면(팀원 담당)과 맞출 규격·상태 규칙이다.

const STORAGE_KEY = 'safety-map:notes'

export const NOTE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  HIDDEN: 'HIDDEN',
}

export const TITLE_MAX = 60
export const CONTENT_MAX = 1000

// 태그는 사용자가 직접 입력한다 (태그 검색·필터 기능은 없음)
export const TAG_MAX = 20

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// 저장 값이 없으면 빈 목록. 깨져 있으면 덮어쓰지 않도록 오류로 알린다.
function readAll() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved == null) return []
  let notes
  try {
    notes = JSON.parse(saved)
  } catch {
    notes = null
  }
  if (!Array.isArray(notes)) {
    throw new ApiError(500, '저장된 안심노트를 읽을 수 없습니다.')
  }
  return notes
}

// YYYY-MM-DD 형식이고 실제 있는 날짜인지 (2026-02-31 같은 값은 거부)
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

// 사용자 지역 기준 오늘 날짜 (YYYY-MM-DD)
export function getLocalToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function writeAll(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

// 네트워크 요청처럼 비동기로 동작하게 한다.
function respond(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), 100))
}

function fail(status, message) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new ApiError(status, message)), 100),
  )
}

function toSummary(note) {
  return {
    id: note.id,
    title: note.title,
    tag: note.tag,
    latitude: note.latitude,
    longitude: note.longitude,
  }
}

// 서버에서도 똑같이 검사해야 하는 입력값 규칙. 오류 메시지 배열을 돌려준다.
export function validateNote({
  title,
  tag,
  observedDate,
  content,
  latitude,
  longitude,
  agreed,
}) {
  const errors = []
  const trimmedTitle = (title ?? '').trim()
  const trimmedContent = (content ?? '').trim()

  if (!trimmedTitle) errors.push('제목을 입력하세요.')
  else if (trimmedTitle.length > TITLE_MAX)
    errors.push(`제목은 ${TITLE_MAX}자 이하로 입력하세요.`)

  const trimmedTag = (tag ?? '').trim()
  if (!trimmedTag) errors.push('태그를 입력하세요.')
  else if (trimmedTag.length > TAG_MAX)
    errors.push(`태그는 ${TAG_MAX}자 이하로 입력하세요.`)

  if (!observedDate) errors.push('관찰 날짜를 선택하세요.')
  else if (!isValidDate(observedDate))
    errors.push('관찰 날짜가 올바르지 않습니다.')
  else if (observedDate > getLocalToday())
    errors.push('관찰 날짜는 오늘 이후로 선택할 수 없습니다.')

  if (!trimmedContent) errors.push('상세 내용을 입력하세요.')
  else if (trimmedContent.length > CONTENT_MAX)
    errors.push(`상세 내용은 ${CONTENT_MAX}자 이하로 입력하세요.`)

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (
    latitude == null ||
    longitude == null ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    errors.push('지도에서 위치를 선택하세요.')
  } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.push('위치 좌표가 올바르지 않습니다.')
  }

  if (!agreed) errors.push('메모가 모든 이용자에게 공개되는 것을 확인해주세요.')

  return errors
}

export async function createNote(input) {
  const errors = validateNote(input)
  if (errors.length > 0) return fail(400, errors.join(' '))

  const notes = readAll()
  const note = {
    // id가 정수가 아닌 기록은 건너뛰어 NaN이 되지 않게 함
    id:
      notes.reduce(
        (max, n) => (Number.isInteger(n?.id) ? Math.max(max, n.id) : max),
        0,
      ) + 1,
    authorId: null, // 로그인 연동 후 세션의 회원 ID로 채운다 (입력값으로 받지 않음)
    title: input.title.trim(),
    observedDate: input.observedDate,
    content: input.content.trim(),
    tag: input.tag.trim(),
    locationName: (input.locationName ?? '').trim(), // 지도에서 고른 위치의 주소 표시
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    status: NOTE_STATUS.PENDING, // 입력에 status가 있어도 무시하고 항상 승인 대기
    createdAt: new Date().toISOString(),
  }
  writeAll([...notes, note])
  return respond({ id: note.id, status: note.status })
}

// 공개 목록 — 로그인 검사 없음, APPROVED만 반환
export async function getApprovedNotes() {
  return respond(
    readAll()
      .filter((n) => n.status === NOTE_STATUS.APPROVED)
      .map(toSummary),
  )
}

// 공개 상세 — 승인되지 않은 글은 ID를 알아도 열 수 없다
export async function getApprovedNote(id) {
  const note = readAll().find(
    (n) => n.id === Number(id) && n.status === NOTE_STATUS.APPROVED,
  )
  if (!note) return fail(404, '안심노트를 찾을 수 없습니다.')
  // 관리자 사유·처리 이력·작성자 정보는 공개 응답에 포함하지 않는다.
  const {
    id: noteId,
    title,
    tag,
    content,
    observedDate,
    locationName,
    latitude,
    longitude,
    createdAt,
    status,
  } = note
  return respond({
    id: noteId,
    title,
    tag,
    content,
    observedDate,
    locationName,
    latitude,
    longitude,
    createdAt,
    status,
  })
}

// null은 관리자 전체 목록. 현재는 localStorage 데모이며 서버 권한 검증이 아니다.
export async function getNotesForAdmin(status = NOTE_STATUS.PENDING) {
  return respond(
    readAll().filter((note) => status == null || note.status === status),
  )
}

export async function updateNoteStatus(
  id,
  nextStatus,
  { reason = '', expectedStatus } = {},
) {
  const notes = readAll()
  const note = notes.find((item) => item.id === Number(id))
  if (!note) return fail(404, '안심노트를 찾을 수 없습니다.')
  if (expectedStatus != null && note.status !== expectedStatus) {
    return fail(
      409,
      '다른 화면에서 이미 처리되었습니다. 목록을 새로고침해 주세요.',
    )
  }
  const transitions = {
    [NOTE_STATUS.PENDING]: [NOTE_STATUS.APPROVED, NOTE_STATUS.REJECTED],
    [NOTE_STATUS.APPROVED]: [NOTE_STATUS.HIDDEN],
    [NOTE_STATUS.HIDDEN]: [NOTE_STATUS.APPROVED],
    [NOTE_STATUS.REJECTED]: [],
  }
  if (!transitions[note.status]?.includes(nextStatus)) {
    return fail(
      409,
      '현재 상태에서는 선택한 처리를 할 수 없습니다. 목록을 새로고침해 주세요.',
    )
  }
  if (typeof reason !== 'string' || reason.trim().length > 500) {
    return fail(400, '처리 사유는 500자 이하로 입력해 주세요.')
  }
  if (
    [NOTE_STATUS.REJECTED, NOTE_STATUS.HIDDEN].includes(nextStatus) &&
    !reason.trim()
  ) {
    return fail(400, '반려·숨김 사유를 입력해 주세요.')
  }
  const now = new Date().toISOString()
  const entry = {
    id: crypto.randomUUID(),
    from: note.status,
    to: nextStatus,
    reason: reason.trim(),
    actor: '개발용 데모 관리자',
    processedAt: now,
  }
  note.status = nextStatus
  note.updatedAt = now
  note.moderationHistory = [...(note.moderationHistory ?? []), entry]
  // 상태와 이력을 하나의 저장 값으로 기록한다. 실패하면 성공 응답을 보내지 않는다.
  writeAll(notes)
  return respond({ id: note.id, status: note.status })
}
