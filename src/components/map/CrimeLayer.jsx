import { useEffect, useState } from 'react'
import { useMap } from '../../hooks/useMap.js'
import {
  fetchCrimeImage,
  getCrimeImageUrl,
  hasSafemapKey,
} from '../../api/crimeApi.js'
import { kakaoTileToBbox } from '../../utils/kakaoTile.js'
import styles from './CrimeLayer.module.css'

const TILESET_ID = 'CRIME_ZONE'
// 이보다 축소하면(레벨 숫자가 크면) 거의 빈 그림이라 요청하지 않음
const MAX_LEVEL = 7
// 원본이 약 4.25m/px라 레벨 5(4m/px)보다 확대해도 더 선명해지지 않음.
// 레벨 1~4에서는 레벨 5 그림을 잘라 확대해서 새 요청을 줄임
const DATA_LEVEL = 5
const TILE = 256
// 서버가 요청을 하나씩 처리해서, 타일 4×4칸을 1024px 한 장으로 받아 요청 수를 줄임
const SPAN = 4

// 타일셋은 전역에 한 번만 등록되므로, 실패 알림도 구독 방식으로 전달
const errorListeners = new Set()
let registered = false

function createTile(x, y, level) {
  const tile = document.createElement('div')
  if (level > MAX_LEVEL) return tile

  const dataLevel = Math.max(level, DATA_LEVEL)
  // 그림 한 장이 지금 레벨에서 가로·세로 몇 칸을 덮는지
  const tilesPerImage = SPAN * 2 ** (dataLevel - level)
  const imageX = Math.floor(x / tilesPerImage)
  const imageY = Math.floor(y / tilesPerImage)
  const url = getCrimeImageUrl(
    kakaoTileToBbox(imageX, imageY, dataLevel, SPAN),
    TILE * SPAN,
  )
  // 그림에서 이 칸의 위치. y가 클수록 북쪽이라 그림 위쪽
  const offsetX = (x % tilesPerImage) * -TILE
  const offsetY = (tilesPerImage - 1 - (y % tilesPerImage)) * -TILE

  tile.style.cssText = `width:${TILE}px;height:${TILE}px;background-size:${TILE * tilesPerImage}px;background-position:${offsetX}px ${offsetY}px`
  fetchCrimeImage(url).then(
    (objectUrl) => {
      tile.style.backgroundImage = `url(${objectUrl})`
    },
    () => errorListeners.forEach((listener) => listener()),
  )
  return tile
}

function registerTileset(kakao) {
  if (registered) return
  kakao.maps.Tileset.add(
    TILESET_ID,
    new kakao.maps.Tileset({ width: 256, height: 256, getTile: createTile }),
  )
  registered = true
}

// 범죄주의구간 WMS 레이어. MapView 안이나 MapLayout 페이지에서 사용
// showAttribution: 출처 문구 표시 (공공누리 4유형 조건)
function CrimeLayer({ showAttribution = true }) {
  const map = useMap()
  const [failed, setFailed] = useState(!hasSafemapKey)

  useEffect(() => {
    if (!map || !hasSafemapKey) return
    const { kakao } = window
    registerTileset(kakao)
    const typeId = kakao.maps.MapTypeId[TILESET_ID]
    map.addOverlayMapTypeId(typeId)
    return () => map.removeOverlayMapTypeId(typeId)
  }, [map])

  useEffect(() => {
    const onError = () => setFailed(true)
    errorListeners.add(onError)
    return () => errorListeners.delete(onError)
  }, [])

  return (
    <>
      {showAttribution && (
        <p className={styles.attribution}>출처: 생활안전지도(경찰청)</p>
      )}
      {failed && (
        <p className={styles.error} role="status">
          범죄주의구간 정보를 불러오지 못한 곳이 있어요.
        </p>
      )}
    </>
  )
}

export default CrimeLayer
