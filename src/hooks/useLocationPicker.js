import { useRef, useState } from 'react'
import { getAddress } from '../utils/geocoder.js'

export const UNKNOWN_ADDRESS = '주소를 확인할 수 없는 위치'

// 지도 클릭·검색으로 위치를 정하고 검색 칸에 주소를 자동으로 채움
// 좌표는 저장·이동용이고 화면에는 주소만 보여줌
// searchBoxProps는 PlaceSearchBox에 그대로 넘기면 됨
export function useLocationPicker({ onSearchSelect } = {}) {
  const [location, setLocation] = useState(null)
  const [query, setQuery] = useState('')
  // 위치를 연달아 고를 때 늦게 온 주소 조회 결과를 버리기 위한 요청 번호
  const requestRef = useRef(0)
  const searchRef = useRef(null)
  const isLocating = location != null && location.address === undefined

  // fallbackAddress: 주소 조회가 실패하면 대신 쓸 주소 (검색 결과의 주소)
  const pick = ({ lat, lng }, fallbackAddress = null) => {
    const requestId = ++requestRef.current
    const normalizedFallback = fallbackAddress?.trim() || undefined
    setLocation({ lat, lng, address: normalizedFallback })
    setQuery(normalizedFallback ?? '주소 확인 중…')
    getAddress({ lat, lng }).then((found) => {
      if (requestId !== requestRef.current) return
      const address = found?.trim() || normalizedFallback || UNKNOWN_ADDRESS
      setLocation({ lat, lng, address })
      setQuery(address)
    })
  }

  const pickFromMap = (position) => {
    searchRef.current?.cancelSearch()
    pick(position)
  }

  const pickFromSearch = (result) => {
    pick({ lat: result.lat, lng: result.lng }, result.address)
    onSearchSelect?.(result)
  }

  // 검색 칸을 고쳐 쓰면 이전에 고른 위치는 무효 (다시 고르거나 지도를 눌러야 함)
  const changeQuery = (next) => {
    requestRef.current += 1
    setQuery(next)
    setLocation(null)
  }

  return {
    location,
    isLocating,
    pickFromMap,
    searchBoxProps: {
      ref: searchRef,
      value: query,
      onValueChange: changeQuery,
      onSelect: pickFromSearch,
    },
  }
}
