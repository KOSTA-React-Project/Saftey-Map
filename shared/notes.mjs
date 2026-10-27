export const NOTE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  HIDDEN: 'HIDDEN',
})
export const TITLE_MAX = 60
export const CONTENT_MAX = 1000
export const TAG_MAX = 20

export function getLocalToday() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

function validDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function coordinate(value, min, max) {
  if (typeof value !== 'number' && typeof value !== 'string') return false
  if (typeof value === 'string' && !value.trim()) return false
  return (
    Number.isFinite(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
  )
}

export function validateNote(input, { today = getLocalToday() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return ['입력값이 올바르지 않습니다.']
  const errors = []
  for (const [key, label, max] of [
    ['title', '제목', TITLE_MAX],
    ['tag', '태그', TAG_MAX],
    ['content', '상세 내용', CONTENT_MAX],
  ]) {
    if (typeof input[key] !== 'string' || !input[key].trim())
      errors.push(`${label}을 입력하세요.`)
    else if (input[key].trim().length > max)
      errors.push(`${label}은 ${max}자 이하로 입력하세요.`)
  }
  if (!validDate(input.observedDate))
    errors.push('관찰 날짜가 올바르지 않습니다.')
  else if (input.observedDate > today)
    errors.push('관찰 날짜는 오늘 이후로 선택할 수 없습니다.')
  if (
    !coordinate(input.latitude, -90, 90) ||
    !coordinate(input.longitude, -180, 180)
  ) {
    errors.push('지도에서 올바른 위치를 선택하세요.')
  }
  if (
    input.locationName != null &&
    (typeof input.locationName !== 'string' ||
      input.locationName.trim().length > 255)
  ) {
    errors.push('위치명은 255자 이하의 문자열로 입력하세요.')
  }
  if (input.agreed !== true)
    errors.push('메모가 모든 이용자에게 공개되는 것을 확인해주세요.')
  return errors
}
