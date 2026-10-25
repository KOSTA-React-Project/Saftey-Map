import { useEffect, useRef, useState } from 'react'
import { MapContext } from '../../hooks/useMap.js'
import MapControls from './MapControls.jsx'
import styles from './MapView.module.css'

const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }

let sdkPromise = null

// 카카오 SDK는 앱 전체에서 한 번만 불러옴
function loadKakaoSdk() {
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_KAKAO_MAP_KEY
    const script = document.createElement('script')
    const fail = (message) => {
      sdkPromise = null
      script.remove()
      reject(new Error(message))
    }

    if (!key) {
      fail('.env에 VITE_KAKAO_MAP_KEY가 없어요.')
      return
    }

    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`
    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        fail(
          '카카오 지도를 불러오지 못했어요. 키와 등록 도메인을 확인해 주세요.',
        )
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    script.onerror = () =>
      fail('카카오 지도를 불러오지 못했어요. 키와 등록 도메인을 확인해 주세요.')
    document.head.append(script)
  })

  return sdkPromise
}

// center·level은 처음 위치. 이후 이동은 useMapCenter 사용
// onClick: 지도를 누르면 { lat, lng } 전달
function MapView({
  center = SEOUL_CITY_HALL,
  level = 4,
  interactive = true,
  showControls = true,
  onClick,
  onCreate,
  className,
  children,
}) {
  const containerRef = useRef(null)
  const initialRef = useRef({ center, level, interactive })
  const onClickRef = useRef(onClick)
  const onCreateRef = useRef(onCreate)
  const [map, setMap] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    onClickRef.current = onClick
    onCreateRef.current = onCreate
  })

  useEffect(() => {
    let active = true
    let observer = null

    loadKakaoSdk()
      .then((kakao) => {
        if (!active) return
        const { center, level, interactive } = initialRef.current
        const created = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level,
        })
        created.setDraggable(interactive)
        created.setZoomable(interactive)
        kakao.maps.event.addListener(created, 'click', (event) =>
          onClickRef.current?.({
            lat: event.latLng.getLat(),
            lng: event.latLng.getLng(),
          }),
        )

        // 컨테이너 크기가 바뀌면 지도 다시 맞춤
        observer = new ResizeObserver(() => created.relayout())
        observer.observe(containerRef.current)

        setMap(created)
        onCreateRef.current?.(created)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })

    return () => {
      active = false
      observer?.disconnect()
      onCreateRef.current?.(null)
    }
  }, [])

  return (
    <MapContext.Provider value={map}>
      <div className={`${styles.mapView} ${className ?? ''}`}>
        <div ref={containerRef} className={styles.canvas} />
        {!map && (
          <p className={styles.status} role="status">
            {error ?? '지도를 불러오고 있어요…'}
          </p>
        )}
        {map && interactive && showControls && <MapControls />}
        {children}
      </div>
    </MapContext.Provider>
  )
}

export default MapView
