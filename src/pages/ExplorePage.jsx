import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import Sidebar from '../components/layout/Sidebar.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import PlaceSearchBox from '../components/search/PlaceSearchBox.jsx'
import { useMapCenter, useMapClick } from '../hooks/useMap.js'
import { useLocationPicker } from '../hooks/useLocationPicker.js'
import { useCrimeType } from '../hooks/useCrimeType.js'
import { CRIME_TYPES, DEFAULT_CRIME_TYPE } from '../constants/crimeTypes.js'
import { getApprovedNotes } from '../api/notesApi.js'
import styles from './ExplorePage.module.css'

const RADIUS_OPTIONS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
]

// 01 지도 탐색 — 주소·장소 검색, 범죄 유형 필터, 승인된 안심노트, 중심·반경 표시
function ExplorePage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [place, setPlace] = useState(null)
  const { crimeType, setCrimeType } = useCrimeType()
  const [pointA, setPointA] = useState({ lat: 37.5665, lng: 126.978 })
  const [radius, setRadius] = useState(500)

  // 검색한 곳으로 지도를 옮기고 중심도 그곳으로
  const { pickFromMap, searchBoxProps } = useLocationPicker({
    onSearchSelect: (result) => {
      setPlace(result)
      setPointA({ lat: result.lat, lng: result.lng })
    },
  })

  // 지도를 누르면 그 지점이 중심(A)이고, 검색 칸에 그곳 주소가 자동으로 들어감
  // 검색으로 고른 장소 표시는 해제
  useMapClick((point) => {
    setPlace(null)
    setPointA(point)
    pickFromMap(point)
  })

  // 검색한 위치로 지도 이동
  useMapCenter(place)

  // 필터는 이 화면에서만 쓰므로, 다른 탭으로 가면 전체로 되돌림
  useEffect(() => () => setCrimeType(DEFAULT_CRIME_TYPE), [setCrimeType])

  useEffect(() => {
    getApprovedNotes()
      .then(setNotes)
      .catch(() => setNotes([]))
  }, [])

  return (
    <>
      <Sidebar>
        <h2 className={styles.title}>이사할 동네, 같은 기준으로 살펴봐요</h2>
        <p className={styles.label}>주소·장소 검색</p>
        {/* 검색어를 고치면 이전에 고른 장소 표시도 해제 */}
        <PlaceSearchBox
          {...searchBoxProps}
          onValueChange={(next) => {
            setPlace(null)
            searchBoxProps.onValueChange(next)
          }}
        />
        {place && (
          <p className={styles.selected}>
            <strong>{place.label}</strong>
            {place.address !== place.label && <span>{place.address}</span>}
          </p>
        )}

        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>범죄 유형</h3>
          <span className={styles.sectionNote}>공공데이터</span>
        </div>
        {/* 버튼 기본 동작(Tab 이동, Enter·Space 선택)에 맞춰 토글 버튼으로 표시 */}
        <div className={styles.typeGrid} role="group" aria-label="범죄 유형">
          {CRIME_TYPES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={crimeType === id}
              className={`${styles.typeButton} ${crimeType === id ? styles.typeSelected : ''}`}
              onClick={() => setCrimeType(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <fieldset className={styles.radius}>
          <legend className={styles.sectionTitle}>반지름 선택</legend>
          {RADIUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={
                radius === option.value
                  ? styles.radiusSelected
                  : styles.radiusOption
              }
            >
              <input
                type="radio"
                name="radius"
                value={option.value}
                checked={radius === option.value}
                onChange={() => setRadius(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <p className={styles.description}>
          지도를 누르면 그 지점을 중심으로 반경을 보여줘요.
        </p>
      </Sidebar>
      {notes.map((note) => (
        <MapMarker
          key={note.id}
          type="note"
          position={{ lat: note.latitude, lng: note.longitude }}
          onClick={() => navigate(`${ROUTES.NOTES}/${note.id}`)}
        />
      ))}
      <MapMarker type="A" position={pointA} />
      <MapRadius center={pointA} radius={radius} />
    </>
  )
}

export default ExplorePage
