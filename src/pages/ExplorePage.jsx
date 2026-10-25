import { useState } from 'react'
import Sidebar from '../components/layout/Sidebar.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import { useMapClick } from '../hooks/useMap.js'

// 임시 예시 데이터 — 지도 컴포넌트 확인용
const SAMPLE_POINT_B = { lat: 37.5547, lng: 126.9707 }
const SAMPLE_NOTES = [
  { id: 1, lat: 37.5688, lng: 126.9822 },
  { id: 2, lat: 37.5641, lng: 126.9752 },
]

function ExplorePage() {
  const [pointA, setPointA] = useState({ lat: 37.5665, lng: 126.978 })

  useMapClick(setPointA)

  return (
    <>
      <Sidebar>
        <h2>이사할 동네, 같은 기준으로 살펴봐요</h2>
        <p>지도를 누르면 A 지점과 반경 500m가 옮겨져요. (지도 확인용 예시)</p>
      </Sidebar>
      <MapMarker type="A" position={pointA} />
      <MapMarker type="B" position={SAMPLE_POINT_B} />
      {SAMPLE_NOTES.map((note) => (
        <MapMarker key={note.id} type="note" position={note} />
      ))}
      <MapRadius center={pointA} radius={500} />
    </>
  )
}

export default ExplorePage
