import { validateNote } from '../../server/src/shared/notes.js'
export {
  NOTE_STATUS,
  TITLE_MAX,
  CONTENT_MAX,
  TAG_MAX,
  getLocalToday,
  validateNote,
} from '../../server/src/shared/notes.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      '안심노트 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.message || '안심노트 요청을 처리하지 못했습니다.',
    )
  if (data == null)
    throw new ApiError(502, '안심노트 서버 응답을 확인할 수 없습니다.')
  return data
}

function changed(result) {
  window.dispatchEvent(new Event('safety-map:notes-updated'))
  return result
}

export async function createNote(input) {
  const errors = validateNote(input)
  if (errors.length) throw new ApiError(400, errors.join(' '))
  return changed(await request('/notes', { method: 'POST', body: input }))
}

export function getApprovedNotes({ signal } = {}) {
  return request('/notes', { signal })
}

export function getApprovedNote(id) {
  return request(`/notes/${encodeURIComponent(id)}`)
}

// 관리자 목록은 서버에서 필터·페이지를 적용한 응답 객체를 받는다.
export function getNotesForAdmin(
  { status = 'PENDING', query = '', tag = '', page = 1, pageSize = 10 } = {},
  { signal } = {},
) {
  const params = new URLSearchParams({ status, query, tag, page, pageSize })
  return request(`/admin/notes?${params}`, { signal })
}

export async function updateNoteStatus(
  id,
  nextStatus,
  { reason = '', expectedStatus } = {},
) {
  return changed(
    await request(`/admin/notes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status: nextStatus, reason, expectedStatus },
    }),
  )
}
