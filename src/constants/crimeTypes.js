// 생활안전지도 범죄주의구간은 같은 레이어에 스타일만 바꿔 유형별로 그림.
// 유형별 스타일 이름은 공개 API 문서에 없고 생활안전지도 웹 지도 코드에서 확인함
export const CRIME_LAYER = 'A2SM_CRMNLHSPOT_TOT'

export const CRIME_TYPES = [
  { id: 'TOT', label: '전체', style: 'A2SM_CrmnlHspot_Tot_Tot' },
  { id: 'BRGLR', label: '강도', style: 'A2SM_CrmnlHspot_Tot_Brglr' },
  { id: 'RAPE', label: '성폭력', style: 'A2SM_CrmnlHspot_Tot_Rape' },
  { id: 'VIOLN', label: '폭력', style: 'A2SM_CrmnlHspot_Tot_Violn' },
  { id: 'THEFT', label: '절도', style: 'A2SM_CrmnlHspot_Tot_Theft' },
  { id: 'MURDER', label: '살인', style: 'A2SM_CrmnlHspot_Tot_Murder' },
]

export const DEFAULT_CRIME_TYPE = 'TOT'

export function findCrimeType(id) {
  return CRIME_TYPES.find((type) => type.id === id) ?? CRIME_TYPES[0]
}
