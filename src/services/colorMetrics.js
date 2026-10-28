// WMS 수신·색상 분류와 분리한, 집계된 픽셀 개수의 순수 계산 함수.
// 등급 방향·범례·이용 조건 검증 전에는 실제 분석 결과로 제공하지 않는다.
export const METRICS_VERSION = 'color-mean-v1'
export const HIGH_GRADE_THRESHOLD = 8 // 시험 기준. 공식 위험 경계가 아님.

const emptyMetrics = (status) => ({
  status,
  version: METRICS_VERSION,
  highGradeThreshold: HIGH_GRADE_THRESHOLD,
  counts: null,
  valid: null,
  total: null,
  unclassified: null,
  unpainted: null,
  distribution: null,
  score: null,
  highGradeRatio: null,
  displayRatio: null,
  unclassifiedRatio: null,
  unclassifiedTotalRatio: null,
  unpaintedRatio: null,
  scoreBounds: null,
})

// 비율은 기존 결과 화면 계약에 맞춰 모두 0~100(%). 반올림은 화면에서만 한다.
export function summarizeCounts(counts, unclassified, unpainted) {
  if (
    !Array.isArray(counts) ||
    counts.length !== 10 ||
    ![...counts, unclassified, unpainted].every(
      (count) => Number.isSafeInteger(count) && count >= 0,
    )
  )
    return emptyMetrics('INVALID_DATA')

  const valid = counts.reduce((sum, count) => sum + count, 0)
  const candidates = valid + unclassified
  const total = candidates + unpainted
  const weightedCount = counts.reduce(
    (sum, count, index) => sum + index * count,
    0,
  )
  if (![valid, candidates, total, weightedCount].every(Number.isSafeInteger)) {
    return emptyMetrics('INVALID_DATA')
  }
  if (!total) return emptyMetrics('EMPTY_AREA')

  const result = {
    ...emptyMetrics(valid ? 'OK' : 'NO_DATA'),
    counts: [...counts],
    valid,
    total,
    unclassified,
    unpainted,
    displayRatio: (valid / total) * 100,
    unclassifiedRatio: candidates ? (unclassified / candidates) * 100 : null,
    unclassifiedTotalRatio: (unclassified / total) * 100,
    unpaintedRatio: (unpainted / total) * 100,
  }
  if (!valid) return result

  result.distribution = counts.map((count) => (count / valid) * 100)
  result.score = (100 * weightedCount) / (9 * valid)
  result.highGradeRatio =
    (counts
      .slice(HIGH_GRADE_THRESHOLD - 1)
      .reduce((sum, count) => sum + count, 0) /
      valid) *
    100
  // U를 전부 1등급 또는 10등급으로 배정한 조건부 범위. 신뢰구간이 아니다.
  const classifiedShare = valid / candidates
  const unknownShare = unclassified / candidates
  result.scoreBounds = {
    lower: classifiedShare * result.score,
    upper: classifiedShare * result.score + 100 * unknownShare,
  }
  return result
}

// 동일 반경·레이어·기간·해상도·분류 설정을 맞춘 집계에만 적용한다.
export function compareMetrics(A, B) {
  if (
    A.status !== 'OK' ||
    B.status !== 'OK' ||
    A.version !== B.version ||
    A.highGradeThreshold !== B.highGradeThreshold
  ) {
    return {
      status: 'NOT_COMPARABLE',
      scoreDifference: null,
      highGradeDifference: null,
      differenceBounds: null,
      directionMayChange: null,
    }
  }
  const lower = A.scoreBounds.lower - B.scoreBounds.upper
  const upper = A.scoreBounds.upper - B.scoreBounds.lower
  return {
    status: 'OK',
    scoreDifference: A.score - B.score,
    highGradeDifference: A.highGradeRatio - B.highGradeRatio,
    differenceBounds: { lower, upper },
    directionMayChange: lower <= 0 && upper >= 0,
  }
}
