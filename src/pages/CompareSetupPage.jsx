import { useEffect, useReducer, useRef, useState } from 'react'
import Sidebar from '../components/layout/Sidebar.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import { useMap, useMapClick } from '../hooks/useMap.js'
import { compareReducer, initialCompareState } from '../utils/compareState.js'
import { comparePlaces } from '../services/compareService.js'
import CompareResultModal from './CompareResultModal.jsx'
import styles from './CompareSetupPage.module.css'

function CompareSetupPage() {
  const [state, dispatch] = useReducer(compareReducer, initialCompareState)
  const [scenario, setScenario] = useState('normal')
  const controllerRef = useRef(null)
  const compareButtonRef = useRef(null)
  const map = useMap()

  useEffect(() => () => controllerRef.current?.abort(), [])

  function change(action) {
    controllerRef.current?.abort()
    dispatch(action)
  }

  useMapClick((position) => {
    if (state.status !== 'ready') change({ type: 'select', position })
  })

  async function handleCompare() {
    if (!state.A || !state.B || state.status === 'loading') return
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

  const nextSlot = state.editing ?? (state.A ? 'B' : 'A')
  const count = Number(Boolean(state.A)) + Number(Boolean(state.B))
  const footer = (
    <div className={styles.footer}>
      <button
        ref={compareButtonRef}
        type="button"
        className={styles.primary}
        disabled={!state.A || !state.B || state.status === 'loading'}
        onClick={handleCompare}
      >
        {state.status === 'loading'
          ? '예시 결과 준비 중…'
          : '같은 조건으로 비교하기'}
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => change({ type: 'reset' })}
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
                <label htmlFor={`point-${slot}`}>{slot} 지점</label>
                <output id={`point-${slot}`} className={styles.coordinate}>
                  {state[slot]
                    ? `위도 ${state[slot].lat.toFixed(5)} / 경도 ${state[slot].lng.toFixed(5)}`
                    : '지도에서 선택해 주세요'}
                </output>
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
              {state.editing
                ? `다음 지도 클릭에서 ${nextSlot} 지점을 선택·수정합니다.`
                : !state.A
                  ? '첫 지도 클릭은 A, 그다음부터는 B가 됩니다.'
                  : !state.B
                    ? '다음 지도 클릭은 B 지점이 됩니다.'
                    : '지도를 누르면 B가 이동합니다. A를 바꾸려면 A 수정 버튼을 눌러 주세요.'}
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
            지도는 Kakao Maps, 결과 수치는 가상 fixture입니다. 실제 WMS나 범죄
            확률을 분석하지 않습니다.
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
