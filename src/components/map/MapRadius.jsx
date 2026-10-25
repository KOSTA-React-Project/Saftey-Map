import { useEffect } from 'react'
import { useMap } from '../../hooks/useMap.js'

// center를 중심으로 radius(m) 점선 원
function MapRadius({ center, radius }) {
  const map = useMap()
  const lat = center?.lat
  const lng = center?.lng

  useEffect(() => {
    if (!map || lat == null || lng == null) return
    const { kakao } = window
    // 카카오 원은 CSS 변수를 못 읽어서 토큰 값을 직접 꺼내 씀
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim()
    const circle = new kakao.maps.Circle({
      map,
      center: new kakao.maps.LatLng(lat, lng),
      radius,
      strokeWeight: 2,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeStyle: 'dash',
      fillColor: color,
      fillOpacity: 0.05,
      zIndex: 2,
    })
    return () => circle.setMap(null)
  }, [map, lat, lng, radius])

  return null
}

export default MapRadius
