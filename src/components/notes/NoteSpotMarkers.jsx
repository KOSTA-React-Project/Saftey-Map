import MapMarker from '../map/MapMarker.jsx'
import { useMapLevel } from '../../hooks/useMap.js'

// 이 단계보다 지도를 더 축소하면 안심노트 마커를 숨김 (카카오 지도는 숫자가 클수록 넓게 보임)
// 범죄주의구간(CrimeLayer MAX_LEVEL)과 같은 단계라 범례의 "확대하면 보여요" 안내를 함께 씀
export const NOTE_MARKER_MAX_LEVEL = 7

// 같은 좌표의 안심노트는 마커 하나로, 개수를 함께 표시
function NoteSpotMarkers({ spots, onSelect }) {
  const level = useMapLevel()
  if (level !== null && level > NOTE_MARKER_MAX_LEVEL) return null

  return spots.map((spot) => (
    <MapMarker
      key={spot.key}
      type="note"
      count={spot.notes.length}
      label={
        spot.notes.length > 1
          ? `이 위치의 안심노트 ${spot.notes.length}개 보기`
          : spot.notes[0].title
      }
      position={spot.position}
      onClick={() => onSelect(spot)}
    />
  ))
}

export default NoteSpotMarkers
