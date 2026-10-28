// 사용자가 2026-10-28 시각 검토로 지정한 라벨. 공식 범례 응답과 구분한다.
export const REVIEWED_COLORS_VERSION = 'user-reviewed-rgba-20261028-v1'
export const REVIEWED_PALETTE = Object.freeze([
  '#ffffb2',
  '#fee88b',
  '#fed165',
  '#fdb751',
  '#fd9b43',
  '#fa7a35',
  '#f45629',
  '#ea3420',
  '#d31a23',
  '#bd0026',
])
export const REVIEWED_COLORS = Object.freeze(
  [
    { rgba: [254, 222, 124, 214], grade: 3 },
    { rgba: [255, 242, 156, 214], grade: 2 },
    { rgba: [254, 238, 150, 214], grade: 2 },
    { rgba: [255, 255, 174, 19], grade: 1 },
    { rgba: [255, 248, 167, 214], grade: 2 },
  ].map((item) => Object.freeze({ ...item, rgba: Object.freeze(item.rgba) })),
)

// 사용자 지정 라벨 주위의 제한된 유사색만 추정한다. 공식·직접 확인 라벨이 아니다.
export const COLOR_INFERENCE = Object.freeze({
  version: 'reviewed-neighbor-rgb6-alpha3-gap2-v1',
  maxRgbDistance: 6,
  maxAlphaDifference: 3,
  minGradeGap: 2,
})
export function inferReviewedColor(red, green, blue, alpha) {
  if (alpha === 0) return null
  const nearestByGrade = new Map()
  for (const sample of REVIEWED_COLORS) {
    if (Math.abs(alpha - sample.rgba[3]) > COLOR_INFERENCE.maxAlphaDifference)
      continue
    const distance = Math.hypot(
      red - sample.rgba[0],
      green - sample.rgba[1],
      blue - sample.rgba[2],
    )
    nearestByGrade.set(
      sample.grade,
      Math.min(nearestByGrade.get(sample.grade) ?? Infinity, distance),
    )
  }
  const ranked = [...nearestByGrade].sort((a, b) => a[1] - b[1])
  if (!ranked.length || ranked[0][1] > COLOR_INFERENCE.maxRgbDistance)
    return null
  const gap = (ranked[1]?.[1] ?? Infinity) - ranked[0][1]
  return {
    grade: gap > COLOR_INFERENCE.minGradeGap ? ranked[0][0] : null,
    reason: gap > COLOR_INFERENCE.minGradeGap ? 'inferred' : 'ambiguous',
    distance: ranked[0][1],
    inferenceVersion: COLOR_INFERENCE.version,
  }
}
