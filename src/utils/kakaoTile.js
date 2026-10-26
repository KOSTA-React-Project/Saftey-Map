// 카카오 지도 타일 격자 (EPSG:5181). 레벨 1 = 0.25m/px, 레벨이 오를 때마다 2배
const ORIGIN_X = -30000
const ORIGIN_Y = -60000
const TILE_SIZE = 256

// 타일 번호(x, y, 레벨) → [minX, minY, maxX, maxY] (단위 m)
// span: 타일 span×span칸을 한 묶음으로 볼 때 사용 (x, y는 묶음 번호)
export function kakaoTileToBbox(x, y, level, span = 1) {
  const size = TILE_SIZE * 0.25 * 2 ** (level - 1) * span
  const minX = ORIGIN_X + x * size
  const minY = ORIGIN_Y + y * size
  return [minX, minY, minX + size, minY + size]
}
