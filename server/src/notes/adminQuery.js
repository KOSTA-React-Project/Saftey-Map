import { NOTE_STATUS } from '../shared/notes.js'

export function parseAdminQuery(query) {
  const text = (value, max, fallback = '') => {
    if (value === undefined) return fallback
    if (typeof value !== 'string' || value.length > max)
      throw new Error('검색 조건의 형식과 길이를 확인해 주세요.')
    return value.trim()
  }
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback
    if (
      typeof value !== 'string' ||
      !/^[1-9]\d{0,5}$/.test(value) ||
      Number(value) > max
    ) {
      throw new Error('페이지는 1~100000, 조회 개수는 1~50으로 입력해 주세요.')
    }
    return Number(value)
  }
  const status = text(query.status, 10, NOTE_STATUS.PENDING)
  if (status && !Object.values(NOTE_STATUS).includes(status))
    throw new Error('조회 상태가 올바르지 않습니다.')
  return {
    status,
    query: text(query.query, 80),
    tag: text(query.tag, 20),
    page: integer(query.page, 1, 100000),
    pageSize: integer(query.pageSize, 10, 50),
  }
}
