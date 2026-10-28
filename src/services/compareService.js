import { isValidPosition } from '../utils/compareState.js'
export { summarizeCounts } from './colorMetrics.js'

// 결과는 서버의 원본 WMS 분석만 사용한다. 데모/실패 시나리오는 운영 경로에 없다.
export async function comparePlaces(
  conditions,
  { signal, fetchImpl = fetch } = {},
) {
  if (
    !isValidPosition(conditions.A) ||
    !isValidPosition(conditions.B) ||
    ![500, 1000].includes(conditions.radius)
  )
    throw new Error('두 지점과 공통 반경을 확인해 주세요.')
  const snapshot = structuredClone(conditions)
  const response = await fetchImpl('/api/public-data/crime-compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      A: { lat: snapshot.A.lat, lng: snapshot.A.lng },
      B: { lat: snapshot.B.lat, lng: snapshot.B.lng },
      radius: snapshot.radius,
    }),
  })
  let result
  try {
    result = await response.json()
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('분석 서버의 응답을 확인할 수 없습니다.', { cause: error })
  }
  if (!response.ok)
    throw new Error(result.message || '분석 요청에 실패했습니다.')
  if (
    result.synthetic !== false ||
    !result.A?.byCrimeType ||
    !result.B?.byCrimeType ||
    result.conditions?.radius !== snapshot.radius ||
    ['A', 'B'].some(
      (slot) =>
        result.conditions?.[slot]?.lat !== snapshot[slot].lat ||
        result.conditions?.[slot]?.lng !== snapshot[slot].lng,
    )
  )
    throw new Error('분석 결과와 요청 조건이 일치하지 않습니다.')
  return { ...result, conditions: snapshot }
}
