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

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
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
  else if (observedDate > new Date().toISOString().slice(0, 10))
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

export function createNote(input) {
  const errors = validateNote(input)
  if (errors.length > 0) return fail(400, errors.join(' '))

  const notes = readAll()
  const note = {
    id: notes.reduce((max, n) => Math.max(max, n.id), 0) + 1,
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
export function getApprovedNotes() {
  return respond(
    readAll()
      .filter((n) => n.status === NOTE_STATUS.APPROVED)
      .map(toSummary),
  )
}

// 공개 상세 — 승인되지 않은 글은 ID를 알아도 열 수 없다
export function getApprovedNote(id) {
  const note = readAll().find(
    (n) => n.id === Number(id) && n.status === NOTE_STATUS.APPROVED,
  )
  if (!note) return fail(404, '안심노트를 찾을 수 없습니다.')
  const publicNote = { ...note }
  delete publicNote.authorId
  return respond(publicNote)
}

export function getNotesForAdmin(status = NOTE_STATUS.PENDING) {
  return respond(readAll().filter((n) => n.status === status))
}

export function updateNoteStatus(id, nextStatus) {
  if (
    nextStatus !== NOTE_STATUS.APPROVED &&
    nextStatus !== NOTE_STATUS.REJECTED
  ) {
    return fail(400, '승인 또는 반려만 선택할 수 있습니다.')
  }

  const notes = readAll()
  const note = notes.find((n) => n.id === Number(id))
  if (!note) return fail(404, '안심노트를 찾을 수 없습니다.')
  // 이미 처리된 글은 다시 처리하지 않는다 (중복 클릭 방지)
  if (note.status !== NOTE_STATUS.PENDING) {
    return fail(409, '이미 처리된 안심노트입니다.')
  }

  note.status = nextStatus
  writeAll(notes)
  return respond({ id: note.id, status: note.status })
}
