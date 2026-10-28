import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from '../../hooks/useMap.js'
import styles from './MapMarker.module.css'

const LABELS = { A: 'A', B: 'B', note: '1', new: 'N' }

// type: 'A' | 'B' | 'note'(안심노트) | 'new'(작성 중 위치)
// count: 같은 자리에 겹친 개수. 안심노트는 1개도 숫자 1로 표시
function MapMarker({
  type = 'note',
  position,
  onClick,
  label = '안심노트 보기',
  count = 1,
}) {
  const map = useMap()
  const [element] = useState(() => document.createElement('div'))
  const onClickRef = useRef(onClick)
  const lat = position?.lat
  const lng = position?.lng
  const clickable = Boolean(onClick)

  useEffect(() => {
    onClickRef.current = onClick
  })

  useEffect(() => {
    if (!map || lat == null || lng == null) return
    const { kakao } = window
    const overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(lat, lng),
      content: element,
      // 승인 노트가 중심 A/B에 가려지지 않게 하고 작성 중 위치는 가장 위에 둔다.
      zIndex: type === 'new' ? 6 : type === 'note' ? 5 : 4,
      // 누를 수 있는 마커는 지도 클릭(중심 이동 등)이 함께 일어나지 않게 함
      clickable,
    })
    return () => overlay.setMap(null)
  }, [map, element, lat, lng, type, clickable])

  // 마커 클릭이 지도 클릭으로 번지지 않게 직접 처리
  useEffect(() => {
    const handleClick = (event) => {
      if (!onClickRef.current) return
      event.stopPropagation()
      onClickRef.current()
    }
    element.addEventListener('click', handleClick)
    return () => element.removeEventListener('click', handleClick)
  }, [element])

  return createPortal(
    <div
      className={`${styles.marker} ${styles[type]}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? label : undefined}
      onKeyDown={(event) => {
        if (onClick && ['Enter', ' '].includes(event.key)) {
          event.preventDefault()
          onClick()
        }
      }}
    >
      {count > 1 ? count : LABELS[type]}
    </div>,
    element,
  )
}

export default MapMarker
