import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../components/layout/Sidebar.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import PlaceSearchBox from '../components/search/PlaceSearchBox.jsx'
import { useMapCenter, useMapClick } from '../hooks/useMap.js'
import { useLocationPicker } from '../hooks/useLocationPicker.js'
import { useCrimeType } from '../hooks/useCrimeType.js'
import { CRIME_TYPES, DEFAULT_CRIME_TYPE } from '../constants/crimeTypes.js'
import { ROUTES } from '../constants/routes.js'
import { useApprovedNotes } from '../hooks/useApprovedNotes.js'
import { useNoteSpots } from '../hooks/useNoteSpots.js'
import NoteSpotMarkers from '../components/notes/NoteSpotMarkers.jsx'
import NoteSpotPanel from '../components/notes/NoteSpotPanel.jsx'
import PointScorePanel from '../components/explore/PointScorePanel.jsx'
import styles from './ExplorePage.module.css'

const RADIUS_OPTIONS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
]

// 01 지도 탐색 — 주소·장소 검색, 범죄 유형 필터, 승인된 안심노트, 중심·반경 표시
function ExplorePage() {
  const { notes, error: notesError } = useApprovedNotes()
  // 마커를 누르면 탭 이동 없이 사이드바에서 그 위치의 노트 목록·상세를 보여줌
  const noteSpots = useNoteSpots(notes)
  const [place, setPlace] = useState(null)
  const { crimeType, setCrimeType } = useCrimeType()
  // 처음엔 중심 없음. 지도 클릭·검색으로 정해짐
  const [pointA, setPointA] = useState(null)
  const [radius, setRadius] = useState(500)
  // '이 위치로 분석하기'를 누르면 왼쪽 패널이 분석 결과로 바뀜
  const [scoreOpen, setScoreOpen] = useState(false)
  // 안심노트가 열리면(마커 클릭·뒤로가기 모두) 지점 분석 패널은 닫음
  // — 노트를 닫고 돌아올 때 자동으로 다시 분석하지 않게
  if (noteSpots.isOpen && scoreOpen) setScoreOpen(false)
  const navigate = useNavigate()

  // 검색한 곳으로 지도를 옮기고 중심도 그곳으로
  const { location, pickFromMap, searchBoxProps } = useLocationPicker({
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

  // A를 다시 누르면 중심·검색 칸·고른 장소 표시를 모두 비움
  const clearPointA = () => {
    setPlace(null)
    setPointA(null)
    setScoreOpen(false)
    searchBoxProps.onValueChange('')
  }

  // 검색한 위치로 지도 이동
  useMapCenter(place)

  // 지금 중심(A)과 반경을 들고 두 지역 비교로 이동. 주소가 아직 없으면 비교 화면에서 다시 조회
  const goCompare = () =>
    navigate(ROUTES.COMPARE, {
      state: { A: { ...pointA, address: location?.address }, radius },
    })

  // 필터는 이 화면에서만 쓰므로, 다른 탭으로 가면 전체로 되돌림
  useEffect(() => () => setCrimeType(DEFAULT_CRIME_TYPE), [setCrimeType])

  return (
    <>
      <Sidebar
        key={noteSpots.isOpen ? 'detail' : scoreOpen ? 'score' : 'overview'}
        initialExpanded={noteSpots.isOpen || scoreOpen}
      >
        {noteSpots.isOpen ? (
          <NoteSpotPanel
            spot={noteSpots.spot}
            noteId={noteSpots.noteId}
            onOpenNote={noteSpots.openNote}
            onBack={noteSpots.backToList}
            onClose={noteSpots.close}
          />
        ) : scoreOpen && pointA ? (
          <PointScorePanel
            point={pointA}
            address={location?.address}
            radius={radius}
            crimeType={crimeType}
            onBack={() => setScoreOpen(false)}
          />
        ) : (
          <>
            {notesError && <p role="status">{notesError}</p>}
            <h2 className={styles.title}>
              선택한 동네를 살펴봐요
            </h2>
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
            <button
              type="button"
              className={styles.compareButton}
              disabled={!pointA}
              onClick={goCompare}
            >
              이 위치로 비교하기
            </button>
            <button
              type="button"
              className={styles.compareButton}
              disabled={!pointA}
              onClick={() => setScoreOpen(true)}
            >
              이 위치로 분석하기
            </button>

            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>범죄 유형</h3>
              <span className={styles.sectionNote}>공공데이터</span>
            </div>
            {/* 버튼 기본 동작(Tab 이동, Enter·Space 선택)에 맞춰 토글 버튼으로 표시 */}
            <div
              className={styles.typeGrid}
              role="group"
              aria-label="범죄 유형"
            >
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
              지도를 누르면 그 지점을 중심으로 반경을 보여줘요. A를 다시 누르면
              지워져요.
            </p>
          </>
        )}
      </Sidebar>
      <NoteSpotMarkers spots={noteSpots.spots} onSelect={noteSpots.openSpot} />
      <MapMarker
        type="A"
        position={pointA}
        label="선택한 중심 지우기"
        onClick={clearPointA}
      />
      <MapRadius center={pointA} radius={radius} />
    </>
  )
}

export default ExplorePage
