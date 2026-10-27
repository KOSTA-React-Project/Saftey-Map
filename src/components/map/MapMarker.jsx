import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from '../../hooks/useMap.js'
import styles from './MapMarker.module.css'

const LABELS = { A: 'A', B: 'B', note: '+', new: 'N' }

// type: 'A' | 'B' | 'note'(안심노트) | 'new'(작성 중 위치)
function MapMarker({ type = 'note', position, onClick, label = '안심노트 보기' }) {
  const map = useMap()
  const [element] = useState(() => document.createElement('div'))
  const onClickRef = useRef(onClick)
  const lat = position?.lat
  const lng = position?.lng

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
    })
    return () => overlay.setMap(null)
  }, [map, element, lat, lng, type])

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
      {LABELS[type]}
    </div>,
    element,
  )
}

export default MapMarker
