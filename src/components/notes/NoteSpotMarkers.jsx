import MapMarker from '../map/MapMarker.jsx'

// 같은 좌표의 안심노트는 마커 하나로, 개수를 함께 표시
function NoteSpotMarkers({ spots, onSelect }) {
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
