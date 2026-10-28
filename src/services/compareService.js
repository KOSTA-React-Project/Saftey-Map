import { isValidPosition } from '../utils/compareState.js'

// 비교 화면에는 선택한 지점과 반경만 전달한다. 수치를 임의로 생성하지 않는다.
export async function comparePlaces(conditions, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('취소됨', 'AbortError')
  if (
    !isValidPosition(conditions?.A) ||
    !isValidPosition(conditions?.B) ||
    ![500, 1000].includes(conditions?.radius)
  )
    throw new Error('두 지점과 공통 반경을 확인해 주세요.')
  return { conditions: structuredClone(conditions) }
}
