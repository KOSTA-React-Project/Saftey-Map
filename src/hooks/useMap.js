import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react'

// 카카오 지도 객체를 하위 컴포넌트에 전달. 불러오는 중이면 null
export const MapContext = createContext(null)

export function useMap() {
  return useContext(MapContext)
}

// 지도 확대 단계를 구독. 지도가 없으면 null (숫자가 클수록 넓게 보임)
export function useMapLevel() {
  const map = useMap()
  const subscribe = useCallback(
    (onChange) => {
      if (!map) return () => {}
      const { event } = window.kakao.maps
      event.addListener(map, 'zoom_changed', onChange)
      return () => event.removeListener(map, 'zoom_changed', onChange)
    },
    [map],
  )
  return useSyncExternalStore(subscribe, () => map?.getLevel() ?? null)
}

// 지도를 누르면 handler({ lat, lng }) 호출
export function useMapClick(handler) {
  const map = useMap()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!map) return
    const { kakao } = window
    const onClick = (event) =>
      handlerRef.current({
        lat: event.latLng.getLat(),
        lng: event.latLng.getLng(),
      })
    kakao.maps.event.addListener(map, 'click', onClick)
    return () => kakao.maps.event.removeListener(map, 'click', onClick)
  }, [map])
}

// position이 바뀌면 지도 중심을 부드럽게 이동
export function useMapCenter(position) {
  const map = useMap()
  const lat = position?.lat
  const lng = position?.lng

  useEffect(() => {
    if (!map || lat == null || lng == null) return
    map.panTo(new window.kakao.maps.LatLng(lat, lng))
  }, [map, lat, lng])
}
