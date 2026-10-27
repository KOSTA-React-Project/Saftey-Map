import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

// 좌표가 완전히 같은 노트만 한 지점으로 묶는다 (주소 검색으로 같은 좌표가 저장된 경우)
// 서버가 최신 작성순으로 주므로 그 순서를 그대로 유지한다
export function groupNotesBySpot(notes) {
  const spots = new Map()
  for (const note of notes) {
    const key = `${note.latitude},${note.longitude}`
    if (!spots.has(key)) {
      spots.set(key, {
        key,
        position: { lat: note.latitude, lng: note.longitude },
        notes: [],
      })
    }
    spots.get(key).notes.push(note)
  }
  return [...spots.values()]
}

// 지점의 노트가 하나면 바로 상세, 여러 개면 목록을 여는 주소 검색값
export function spotSearchParams(spot) {
  return spot.notes.length === 1
    ? { spot: spot.key, note: String(spot.notes[0].id) }
    : { spot: spot.key }
}

// 지도 마커로 고른 지점·노트를 주소(?spot=&note=)에 담아 뒤로가기와 맞춘다
export function useNoteSpots(notes) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const spots = useMemo(() => groupNotesBySpot(notes), [notes])
  const spotKey = params.get('spot')
  const noteId = params.get('note')
  const spot = spots.find((item) => item.key === spotKey) ?? null

  return {
    spots,
    spot,
    noteId,
    isOpen: spotKey != null || noteId != null,
    openSpot: (next) => setParams(spotSearchParams(next)),
    openNote: (id) =>
      setParams(spotKey ? { spot: spotKey, note: String(id) } : { note: id }, {
        state: { fromList: true },
      }),
    // 목록에서 열었으면 한 단계 뒤로, 주소로 바로 들어왔으면 목록으로 바꿔치기
    // (뒤로가기가 상세로 다시 들어가지 않게)
    backToList: () =>
      location.state?.fromList
        ? navigate(-1)
        : setParams({ spot: spotKey }, { replace: true }),
    close: () => setParams({}),
  }
}
