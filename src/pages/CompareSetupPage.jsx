import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import Sidebar from '../components/layout/Sidebar.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import PlaceSearchBox from '../components/search/PlaceSearchBox.jsx'
import { getAddress } from '../utils/geocoder.js'
import { useCrimeType } from '../hooks/useCrimeType.js'
import { useMap, useMapClick } from '../hooks/useMap.js'
import { compareReducer, initialCompareState } from '../utils/compareState.js'
import { comparePlaces } from '../services/compareService.js'
import CompareResultModal from './CompareResultModal.jsx'
import styles from './CompareSetupPage.module.css'

const EXPLORE_SELECTION = 'explore'

// 지도 탐색의 '이 위치로 비교하기'로 들어오면 그 지점을 A로, 반경도 그대로 시작
function stateFromExplore(from) {
  if (!from?.A) return initialCompareState
  const { lat, lng, address } = from.A
  return [
    { type: 'radius', radius: from.radius },
    {
      type: 'select',
      slot: 'A',
      position: {
        lat,
        lng,
        address: address?.trim() || '',
        selectionId: EXPLORE_SELECTION,
      },
    },
  ].reduce(compareReducer, initialCompareState)
}

function CompareSetupPage() {
  const { state: fromExplore } = useLocation()
  const [state, dispatch] = useReducer(
    compareReducer,
    fromExplore,
    stateFromExplore,
  )
  const [scenario, setScenario] = useState('normal')
  const controllerRef = useRef(null)
  const compareButtonRef = useRef(null)
  const map = useMap()
  const { crimeType } = useCrimeType()
  const [queries, setQueries] = useState({ A: null, B: null })
  const searchRefs = useRef({})
  const addressPending = [state.A, state.B].some(
    (point) => point && !point.address,
  )

  useEffect(() => () => controllerRef.current?.abort(), [])

  function change(action) {
    controllerRef.current?.abort()
    dispatch(action)
  }

  function selectPoint(position, requestedSlot) {
    const slot =
      requestedSlot ?? state.editing ?? (state.lastSelected === 'A' ? 'B' : 'A')
    const selectionId = crypto.randomUUID()
    const fallback = position.address?.trim() || ''
    searchRefs.current[slot]?.cancelSearch()
    setQueries((previous) => ({ ...previous, [slot]: null }))
    change({
      type: 'select',
      slot,
      position: {
        lat: position.lat,
        lng: position.lng,
        address: fallback,
        selectionId,
      },
    })
    if (requestedSlot && map) {
      map.panTo(new window.kakao.maps.LatLng(position.lat, position.lng))
    }
    getAddress(position).then(
      (address) =>
        dispatch({
          type: 'address',
          slot,
          selectionId,
          address: address?.trim() || fallback || '주소를 확인할 수 없는 위치',
        }),
      () =>
        dispatch({
          type: 'address',
          slot,
          selectionId,
          address: fallback || '주소를 확인할 수 없는 위치',
        }),
    )
  }

  useMapClick((position) => {
    if (state.status !== 'ready') selectPoint(position)
  })

  // 탐색에서 넘어온 A로 지도를 옮기고, 주소 없이 왔으면 여기서 찾음
  const locateFromExplore = useEffectEvent(() => {
    const point = state.A
    if (point?.selectionId !== EXPLORE_SELECTION) return
    map?.panTo(new window.kakao.maps.LatLng(point.lat, point.lng))
    if (point.address) return
    const done = (address) =>
      dispatch({
        type: 'address',
        slot: 'A',
        selectionId: EXPLORE_SELECTION,
        address: address?.trim() || '주소를 확인할 수 없는 위치',
      })
    getAddress(point).then(done, () => done(null))
  })
  useEffect(() => locateFromExplore(), [])

  async function handleCompare() {
    if (!state.A || !state.B || addressPending || state.status === 'loading')
      return
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = crypto.randomUUID()
    const revision = state.revision
    dispatch({ type: 'start', requestId })
    try {
      const result = await comparePlaces(
        { A: state.A, B: state.B, radius: state.radius },
        { signal: controller.signal, scenario },
      )
      dispatch({ type: 'success', result, revision, requestId })
    } catch (error) {
      if (error.name !== 'AbortError')
        dispatch({ type: 'failure', error: error.message, revision, requestId })
    }
  }

  const nextSlot = state.editing ?? (state.lastSelected === 'A' ? 'B' : 'A')
  const count = Number(Boolean(state.A)) + Number(Boolean(state.B))
  const footer = (
    <div className={styles.footer}>
      <button
        ref={compareButtonRef}
        type="button"
        className={styles.primary}
        disabled={
          !state.A || !state.B || addressPending || state.status === 'loading'
        }
        onClick={handleCompare}
      >
        {state.status === 'loading'
          ? '예시 결과 준비 중…'
          : '같은 조건으로 비교하기'}
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          Object.values(searchRefs.current).forEach((search) =>
            search?.cancelSearch(),
          )
          setQueries({ A: null, B: null })
          change({ type: 'reset' })
        }}
      >
        지점 초기화
      </button>
      <p role="status">{count}개 지점 선택 완료</p>
    </div>
  )

  return (
    <>
      <Sidebar footer={footer}>
        <div className={styles.content}>
          <p className={styles.eyebrow}>COMPARE / 01</p>
          <h1>
            어느 두 동네를
            <br />
            비교할까요?
          </h1>
          <p>지도에서 두 지점을 고르면 같은 반경으로 비교할 수 있어요.</p>
          <span className={styles.badge}>
            비교 수치는 예시 · 실제 분석 미연결
          </span>
          <section className={styles.section} aria-labelledby="point-heading">
            <h2 id="point-heading">1 비교 지점</h2>
            {['A', 'B'].map((slot) => (
              <div className={styles.point} key={slot}>
                <strong>{slot} 지점</strong>
                <PlaceSearchBox
                  ref={(instance) => {
                    searchRefs.current[slot] = instance
                  }}
                  value={queries[slot] ?? state[slot]?.address ?? ''}
                  onValueChange={(value) =>
                    setQueries((previous) => ({ ...previous, [slot]: value }))
                  }
                  onSelect={(position) => selectPoint(position, slot)}
                  placeholder={`${slot} 지점 주소나 장소 검색`}
                />
                <p className={styles.pointAddress} role="status">
                  {state[slot]
                    ? `선택한 주소: ${state[slot].address || '주소 확인 중…'}`
                    : '검색 결과를 선택하거나 지도에서 지점을 골라 주세요.'}
                </p>
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={state.editing === slot}
                  onClick={() => change({ type: 'edit', slot })}
                >
                  {slot} 지점 선택·수정
                </button>
              </div>
            ))}
            <p className={styles.notice} role="status">
              다음 지도 클릭은 {nextSlot} 지점을 선택·수정합니다. 지점을 변경할
              때마다 다음 선택 지점은 A/B로 번갈아 바뀝니다.
            </p>
            {!map && (
              <p role="status">
                지도가 준비되지 않았습니다. 지도 영역의 키·등록 도메인 안내를
                확인해 주세요.
              </p>
            )}
          </section>
          <fieldset className={styles.section}>
            <legend>2 두 지점에 적용할 반경</legend>
            <div className={styles.radiusOptions}>
              {[500, 1000].map((radius) => (
                <button
                  type="button"
                  key={radius}
                  className={styles.button}
                  aria-pressed={state.radius === radius}
                  onClick={() => change({ type: 'radius', radius })}
                >
                  {radius === 500 ? '500m' : `${radius / 1000}km`}
                </button>
              ))}
            </div>
            <p className={styles.notice}>
              두 지점 모두 직선거리{' '}
              {state.radius === 500 ? '500m' : `${state.radius / 1000}km`}{' '}
              기준입니다. 지점이나 반경을 바꾸면 이전 결과는 지워집니다.
            </p>
          </fieldset>
          <label className={styles.scenario}>
            예시 응답 상태
            <select
              value={scenario}
              onChange={(event) => {
                setScenario(event.target.value)
                change({ type: 'radius', radius: state.radius })
              }}
            >
              <option value="normal">정상</option>
              <option value="slow">느린 응답 · 2초</option>
              <option value="error">실패 재현</option>
              <option value="empty">데이터 없음</option>
            </select>
          </label>
          {state.status === 'loading' && (
            <p role="status">
              예시 결과를 준비하고 있어요. 지점·반경 변경 시 요청이 취소됩니다.
            </p>
          )}
          {state.error && (
            <p className={styles.notice} role="alert">
              {state.error}
            </p>
          )}
          <p>
            지도는 Kakao Maps와 생활안전지도 WMS를 표시합니다. 결과 수치는 별도
            가상 fixture이며 지도 이미지나 범죄 확률을 분석하지 않습니다.
          </p>
        </div>
      </Sidebar>
      <MapMarker type="A" position={state.A} />
      <MapMarker type="B" position={state.B} />
      <MapRadius center={state.A} radius={state.radius} />
      <MapRadius center={state.B} radius={state.radius} />
      {state.status === 'ready' && state.result && (
        <CompareResultModal
          result={state.result}
          crimeType={crimeType}
          onClose={() => {
            dispatch({ type: 'close' })
            requestAnimationFrame(() => compareButtonRef.current?.focus())
          }}
        />
      )}
    </>
  )
}

export default CompareSetupPage
