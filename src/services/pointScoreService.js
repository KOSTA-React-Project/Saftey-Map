import { isValidPosition } from '../utils/compareState.js'

// 지도 탐색 한 지점 분석 — 결과는 서버의 원본 WMS 분석만 사용한다 (compareService.js와 같은 방식)
export async function scorePlace(
  { point, radius },
  { signal, fetchImpl = fetch } = {},
) {
  if (!isValidPosition(point) || ![500, 1000].includes(radius))
    throw new Error('지점과 반경을 확인해 주세요.')
  const response = await fetchImpl('/api/public-data/crime-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ point: { lat: point.lat, lng: point.lng }, radius }),
  })
  let result
  try {
    result = await response.json()
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('분석 서버의 응답을 확인할 수 없습니다.', { cause: error })
  }
  if (!response.ok) {
    const error = new Error(result.message || '분석 요청에 실패했습니다.')
    // 화면에서 '처리 중(ANALYSIS_BUSY)'이면 한 번 다시 시도하려고 서버 코드를 함께 넘김
    error.code = result.code
    throw error
  }
  if (
    result.synthetic !== false ||
    !result.result?.byCrimeType ||
    result.conditions?.radius !== radius ||
    result.conditions?.point?.lat !== point.lat ||
    result.conditions?.point?.lng !== point.lng
  )
    throw new Error('분석 결과와 요청 조건이 일치하지 않습니다.')
  return result
}
