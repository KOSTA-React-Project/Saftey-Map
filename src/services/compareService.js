import { isValidPosition } from '../utils/compareState.js'

export function summarizeCounts(counts, unclassified, unpainted) {
  const valid = counts.reduce((sum, count) => sum + count, 0)
  const total = valid + unclassified + unpainted
  if (!valid) return { score: null, status: 'NO_DATA' }
  return {
    status: 'OK',
    counts,
    valid,
    total,
    unclassified,
    unpainted,
    distribution: counts.map((count) => (count / valid) * 100),
    score:
      counts.reduce(
        (sum, count, index) => sum + ((count * index) / 9) * 100,
        0,
      ) / valid,
    displayRatio: (valid / total) * 100,
  }
}

function fixtureFor(point, radius) {
  const seed =
    Math.abs(Math.round(point.lat * 1000) + Math.round(point.lng * 1000)) +
    radius / 500
  return summarizeCounts(
    Array.from({ length: 10 }, (_, i) => 5 + ((seed + i * 3) % 13)),
    12,
    28,
  )
}

export async function comparePlaces(
  conditions,
  { signal, scenario = 'normal' } = {},
) {
  if (
    !isValidPosition(conditions.A) ||
    !isValidPosition(conditions.B) ||
    ![500, 1000].includes(conditions.radius)
  )
    throw new Error('두 지점과 공통 반경을 확인해 주세요.')
  const snapshot = structuredClone(conditions)
  await new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('취소됨', 'AbortError'))
      return
    }
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('취소됨', 'AbortError'))
    }
    const timer = setTimeout(
      () => {
        signal?.removeEventListener('abort', abort)
        resolve()
      },
      scenario === 'slow' ? 2000 : 350,
    )
    signal?.addEventListener('abort', abort, { once: true })
  })
  if (scenario === 'error')
    throw new Error(
      '예시 요청 실패를 재현했습니다. 정상 모드로 바꾸고 다시 비교해 주세요.',
    )
  if (scenario === 'empty')
    throw new Error('분석할 예시 데이터가 없습니다. 결과는 제공하지 않습니다.')
  return {
    conditions: snapshot,
    A: fixtureFor(snapshot.A, snapshot.radius),
    B: fixtureFor(snapshot.B, snapshot.radius),
    queriedAt: new Date().toISOString(),
    version: 'demo-v1',
  }
}
