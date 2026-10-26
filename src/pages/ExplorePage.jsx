import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '../constants/routes.js'
import Sidebar from '../components/layout/Sidebar.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import PlaceSearchBox from '../components/search/PlaceSearchBox.jsx'
import { useMapCenter } from '../hooks/useMap.js'
import { useCrimeType } from '../hooks/useCrimeType.js'
import { CRIME_TYPES, DEFAULT_CRIME_TYPE } from '../constants/crimeTypes.js'
import { getApprovedNotes } from '../api/notesApi.js'
import styles from './ExplorePage.module.css'

// 01 지도 탐색 — 주소·장소 검색, 범죄 유형 필터, 승인된 안심노트 표시
function ExplorePage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [place, setPlace] = useState(null)
  const { crimeType, setCrimeType } = useCrimeType()

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
        <PlaceSearchBox onSelect={setPlace} />
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
        <div
          className={styles.typeGrid}
          role="radiogroup"
          aria-label="범죄 유형"
        >
          {CRIME_TYPES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={crimeType === id}
              className={`${styles.typeButton} ${crimeType === id ? styles.typeSelected : ''}`}
              onClick={() => setCrimeType(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </Sidebar>
      {notes.map((note) => (
        <MapMarker
          key={note.id}
          type="note"
          position={{ lat: note.latitude, lng: note.longitude }}
          onClick={() => navigate(`${ROUTES.NOTES}/${note.id}`)}
        />
      ))}
    </>
  )
}

export default ExplorePage
