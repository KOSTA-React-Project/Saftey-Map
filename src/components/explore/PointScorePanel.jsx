import { useEffect, useRef, useState } from 'react'
import MapView from '../map/MapView.jsx'
import MapMarker from '../map/MapMarker.jsx'
import MapRadius from '../map/MapRadius.jsx'
import CrimeLayer from '../map/CrimeLayer.jsx'
import { CRIME_TYPES } from '../../constants/crimeTypes.js'
import { scorePlace } from '../../services/pointScoreService.js'
import panel from '../notes/NoteSpotPanel.module.css'
import own from './PointScorePanel.module.css'
// 두 지역 비교 결과와 같은 모양으로 보이도록 비교 화면 스타일을 그대로 씀
import styles from '../../pages/CompareSetupPage.module.css'

// 화면 크기가 바뀌어도 선택 지점을 중앙에 유지 (비교 결과 지도와 같은 방식)
function ResultMap({ point, radius, crimeType }) {
  const containerRef = useRef(null)
  const [map, setMap] = useState(null)

  useEffect(() => {
    if (!map) return
    const observer = new ResizeObserver(() => {
      map.relayout()
      map.setCenter(new window.kakao.maps.LatLng(point.lat, point.lng))
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [map, point.lat, point.lng])

  return (
    <div ref={containerRef} className={styles.resultMap}>
      <MapView
        center={point}
        level={radius === 500 ? 4 : 5}
        interactive={false}
        showControls={false}
        onCreate={setMap}
        className={styles.resultMapCanvas}
      >
        <CrimeLayer crimeType={crimeType} />
        <MapMarker type="A" position={point} />
        <MapRadius center={point} radius={radius} />
      </MapView>
    </div>
  )
}

function formatNumber(value, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : '분석 불가'
}

// 지도 탐색 왼쪽 패널 — 고른 지점 하나의 분석 결과 (두 지역 비교 결과를 한 지역으로 줄인 모양)
// point·radius는 지금 지도에서 고른 값. 분석은 패널을 열 때와 '변경 위치로 분석하기'를 누를 때만 함
function PointScorePanel({ point, address, radius, crimeType, onBack }) {
  // 분석할(했던) 지점·반경. 지도에서 위치를 바꿔도 버튼을 누르기 전까지는 그대로
  const [target, setTarget] = useState({ point, radius, address })
  // result: 마지막으로 받은 결과 (다시 분석하는 동안에도 흐리게 보여 줌)
  const [state, setState] = useState({ status: 'loading', result: null })

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer
    const run = (retried) =>
      scorePlace(target, { signal: controller.signal })
        .then((result) => setState({ status: 'ready', result }))
        .catch((error) => {
          if (error.name === 'AbortError') return
          // 앞 분석이 서버에서 정리되는 중이면 1초 뒤 한 번만 다시 시도
          if (error.code === 'ANALYSIS_BUSY' && !retried) {
            retryTimer = setTimeout(() => run(true), 1000)
            return
          }
          setState((prev) => ({
            ...prev,
            status: 'error',
            message: error.message,
          }))
        })
    // 개발 모드에서 두 번 실행돼도 요청은 한 번만 가도록 다음 차례로 미룸
    const timer = setTimeout(() => run(false), 0)
    return () => {
      clearTimeout(timer)
      clearTimeout(retryTimer)
      controller.abort()
    }
  }, [target])

  // 지도에서 고른 위치·반경이 분석한 것과 다르면 '변경 위치로 분석하기' 버튼을 보여 줌
  const changed =
    point.lat !== target.point.lat ||
    point.lng !== target.point.lng ||
    radius !== target.radius
  const analyzeChanged = () => {
    setState((prev) => ({ ...prev, status: 'loading' }))
    setTarget({ point, radius, address })
  }

  const data = state.result?.result
  const showResult = Boolean(data) && state.status !== 'error'

  return (
    <section aria-label="선택한 지점 분석 결과" className={own.panel}>
      <div className={panel.head}>
        <button type="button" className={panel.back} onClick={onBack}>
          ← 돌아가기
        </button>
      </div>
      <div className={own.intro}>
        <p className={styles.eyebrow}>EXPLORE · 지점 분석 결과</p>
        <h2>선택한 동네를 같은 반경으로</h2>
        <p>점수가 높을수록 범죄 주의 단계가 높습니다.</p>
      </div>

      {changed && (
        <div className={styles.notice} role="status">
          <p>위치가 바뀌었어요. 아래 결과는 이전 위치 기준이에요.</p>
          <button
            type="button"
            className={styles.button}
            disabled={state.status === 'loading'}
            onClick={analyzeChanged}
          >
            변경 위치로 분석하기
          </button>
        </div>
      )}
      {state.status === 'loading' && (
        <p role="status">
          원본 지도 이미지를 분석하고 있어요. 잠시만 기다려 주세요.
        </p>
      )}
      {state.status === 'error' && (
        <p className={styles.notice} role="alert">
          {state.message}
        </p>
      )}

      {showResult && (
        <div
          className={`${own.result} ${changed || state.status === 'loading' ? own.dimmed : ''}`}
        >
          <section aria-label="지점 분석 결과" className={styles.resultCard}>
            <h3>선택한 지점 주변</h3>
            <p>{target.address || '주소를 확인할 수 없는 위치'}</p>
            <ResultMap
              point={target.point}
              radius={target.radius}
              crimeType={crimeType}
            />
            <span className={styles.badge}>범죄 주의 단계 점수</span>
            <p className={styles.score}>
              {formatNumber(data.score)}
              {data.score != null && <small> / 100</small>}
            </p>
            {data.status !== 'OK' && (
              <p role="status">판별된 자료가 없어 지수를 제공하지 않습니다.</p>
            )}
            <section aria-label="범죄 유형별 점수">
              <h4>범죄 유형별 점수</h4>
              <dl className={styles.typeScores}>
                {CRIME_TYPES.filter(({ id }) => id !== 'TOT').map(
                  ({ id, label }) => (
                    <div key={id}>
                      <dt>{label}</dt>
                      <dd>
                        <strong>
                          {formatNumber(data.byCrimeType?.[id]?.score)}
                        </strong>
                        {data.byCrimeType?.[id]?.score != null && (
                          <small> / 100</small>
                        )}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </section>
            <p>
              미표시 영역은 안전 지역으로 해석하지 않습니다. 주민 메모는 지수에
              반영하지 않습니다.
            </p>
          </section>

          <details className={styles.notice}>
            <summary>산식·분석 기준 확인</summary>
            <div className={styles.analysisDetails}>
              <section aria-label="계산식과 데이터 기준">
                <h3>계산식과 데이터 기준</h3>
                <p>색상 평균 지수 S = 100 × Σ[(k−1) × nₖ] ÷ (9 × M).</p>
                <p>
                  범죄 유형별로 독립된 집계에 같은 산식을 적용합니다. 전체
                  점수는 개별 유형 점수의 합이나 평균이 아닙니다.
                </p>
                <p>
                  M은 판별 성공, U는 미분류, E는 미표시, T=M+U+E입니다. 지수가
                  높다고 실제 범죄 확률이 높다는 의미는 아닙니다.
                </p>
                <p>
                  판별 성공 비율은 M/T, 후보 중 미분류 비율은 U/(M+U), 등급별
                  분포는 nₖ/M입니다. 모두 %로 표시합니다.
                </p>
                <p>
                  M=0이면 지수·분포·높은 등급 비중을 제공하지 않습니다. 8등급
                  경계는 공식 위험 경계가 아닌 시험 기준입니다.
                </p>
              </section>
              <section aria-label="전체 유형 분석 상세">
                <h3>선택한 지점 · 전체 유형 분석 상세</h3>
                <dl className={styles.typeScores}>
                  <div>
                    <dt>판별 성공 비율</dt>
                    <dd>{formatNumber(data.displayRatio, '%')}</dd>
                  </div>
                  <div>
                    <dt>후보 중 미분류 비율</dt>
                    <dd>{formatNumber(data.unclassifiedRatio, '%')}</dd>
                  </div>
                  <div>
                    <dt>8~10등급 색상 비중</dt>
                    <dd>{formatNumber(data.highGradeRatio, '%')}</dd>
                  </div>
                </dl>
                <p>
                  유효 {data.valid ?? '없음'} / 전체 {data.total ?? '없음'} 픽셀
                  · 미분류 {data.unclassified ?? '없음'} · 미표시{' '}
                  {data.unpainted ?? '없음'}
                </p>
                <h4>판별된 등급 픽셀 내 분포</h4>
                <ol className={styles.gradeList}>
                  {(data.distribution ?? []).map((value, index) => (
                    <li key={index}>
                      {index + 1}등급 <strong>{value.toFixed(1)}%</strong>
                    </li>
                  ))}
                </ol>
                <p>
                  미분류 조건부 지수 범위:{' '}
                  {formatNumber(data.scoreBounds?.lower)} ~{' '}
                  {formatNumber(data.scoreBounds?.upper)}
                </p>
              </section>
              <section aria-label="분석의 한계">
                {state.result.source?.classifier && (
                  <p>
                    원본 분류 설정: alpha ≥{' '}
                    {state.result.source.classifier.alphaMin}, RGB 거리 ≤{' '}
                    {state.result.source.classifier.maxDistance}, 2순위 거리
                    차이 &gt; {state.result.source.classifier.minGap}. 시험
                    설정이며 낮은 alpha·애매한 색상은 미분류입니다. 사용자 지정
                    색상과 제한된 유사색 추정 규칙을 우선 적용합니다.
                  </p>
                )}
                <h3>분석의 한계</h3>
                <p>
                  조건부 범위는 미분류를 모두 1등급 또는 10등급으로 가정한
                  값으로 신뢰구간이 아닙니다. 오분류·공간 오차를 포함하지
                  않습니다.
                </p>
                <p>
                  지도는 생활안전지도 자료를 표시합니다. 점수는 참고용 지표로,
                  실제 범죄 확률이나 도로 길이 비율을 뜻하지 않습니다.
                </p>
              </section>
            </div>
          </details>
        </div>
      )}
    </section>
  )
}

export default PointScorePanel
