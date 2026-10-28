import { useEffect, useRef, useState } from 'react'
import MapView from '../components/map/MapView.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import CrimeLayer from '../components/map/CrimeLayer.jsx'
import { CRIME_TYPES } from '../constants/crimeTypes.js'
import styles from './CompareSetupPage.module.css'

// 탭에 가려진 지도가 다시 보이거나 화면 크기가 바뀌어도 선택 지점을 중앙에 유지한다.
function ResultMap({ point, radius, slot, crimeType }) {
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
        level={radius === 500 ? 4 : radius === 1000 ? 5 : 6}
        interactive={false}
        showControls={false}
        onCreate={setMap}
        className={styles.resultMapCanvas}
      >
        <CrimeLayer crimeType={crimeType} />
        <MapMarker type={slot} position={point} />
        <MapRadius center={point} radius={radius} />
      </MapView>
    </div>
  )
}

function formatNumber(value, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : '분석 불가'
}

function CompareResultModal({ result, crimeType, onClose }) {
  const dialogRef = useRef(null)
  const [tab, setTab] = useState('A')

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby="compare-result-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className={styles.modalHeader}>
        <div>
          <p className={styles.eyebrow}>COMPARE / 02 · 비교 결과</p>
          <h2 id="compare-result-title">두 동네를 같은 반경으로 나란히</h2>
        </div>
        <button
          type="button"
          autoFocus
          className={styles.button}
          onClick={onClose}
        >
          지점·반경 다시 선택 / 닫기
        </button>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="비교 지점 전환">
        {['A', 'B'].map((slot) => (
          <button
            key={slot}
            id={`tab-${slot}`}
            role="tab"
            type="button"
            aria-selected={tab === slot}
            aria-controls={`result-${slot}`}
            tabIndex={tab === slot ? 0 : -1}
            className={styles.button}
            onClick={() => setTab(slot)}
            onKeyDown={(event) => {
              if (
                ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 'A'
                    : event.key === 'End'
                      ? 'B'
                      : slot === 'A'
                        ? 'B'
                        : 'A'
                setTab(next)
                document.getElementById(`tab-${next}`).focus()
              }
            }}
          >
            {slot} 지역
          </button>
        ))}
      </div>
      <div className={styles.results}>
        {['A', 'B'].map((slot) => {
          const data = result[slot]
          const point = result.conditions[slot]
          return (
            <section
              key={slot}
              id={`result-${slot}`}
              aria-label={`${slot} 지역 비교 결과`}
              className={`${styles.resultCard} ${tab !== slot ? styles.inactive : ''}`}
            >
              <h3>{slot} 지점 주변</h3>
              <p>{point.address || '주소를 확인할 수 없는 위치'}</p>
              <ResultMap
                point={point}
                radius={result.conditions.radius}
                slot={slot}
                crimeType={crimeType}
              />
              <span className={styles.badge}>범죄 주의 단계 점수</span>
              <p className={styles.score}>
                {formatNumber(data.score)}
                {data.score != null && <small> / 100</small>}
              </p>
              {data.status !== 'OK' && (
                <p role="status">
                  판별된 자료가 없어 지수를 제공하지 않습니다.
                </p>
              )}
              <section aria-label={`${slot} 범죄 유형별 점수`}>
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
                미표시 영역은 안전 지역으로 해석하지 않습니다. 주민 메모는
                지수에 반영하지 않습니다.
              </p>
            </section>
          )
        })}
      </div>
      <details className={styles.notice}>
        <summary>산식·분석 기준 확인</summary>
        <div className={styles.analysisDetails}>
          <section aria-label="계산식과 데이터 기준">
            <h3>계산식과 데이터 기준</h3>
            <p>색상 평균 지수 S = 100 × Σ[(k−1) × nₖ] ÷ (9 × M).</p>
            <p>
              범죄 유형별로 독립된 집계에 같은 산식을 적용합니다. 전체 점수는
              개별 유형 점수의 합이나 평균이 아닙니다.
            </p>
            <p>
              M은 판별 성공, U는 미분류, E는 미표시, T=M+U+E입니다. 지수가
              높다고 실제 범죄 확률이 높다는 의미는 아닙니다.
            </p>
            <p>
              판별 성공 비율은 M/T, 후보 중 미분류 비율은 U/(M+U), 등급별 분포는
              nₖ/M입니다. 모두 %로 표시합니다.
            </p>
            <p>
              M=0이면 지수·분포·높은 등급 비중을 제공하지 않습니다. 8등급 경계는
              공식 위험 경계가 아닌 시험 기준입니다.
            </p>
          </section>
          <div className={styles.detailsGrid}>
            {['A', 'B'].map((slot) => {
              const data = result[slot]
              return (
                <section key={slot} aria-label={`${slot} 전체 유형 분석 상세`}>
                  <h3>{slot} 지점 · 전체 유형 분석 상세</h3>
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
                    유효 {data.valid ?? '없음'} / 전체 {data.total ?? '없음'}{' '}
                    픽셀 · 미분류 {data.unclassified ?? '없음'} · 미표시{' '}
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
              )
            })}
          </div>
          <section aria-label="A/B 지수 차이">
            <h3>A/B 차이</h3>
            <p>
              전체 유형 기준 A − B 색상 평균 지수:{' '}
              {formatNumber(result.comparison?.scoreDifference)}
            </p>
            <p>
              A − B 8~10등급 색상 비중:{' '}
              {formatNumber(result.comparison?.highGradeDifference, '%p')}
            </p>
            <p>
              양수는 A가 높고, 음수는 B가 높습니다. 실제 안전 우열을 뜻하지
              않습니다.
            </p>
            {result.comparison?.directionMayChange && (
              <p>
                미분류 색상의 배정에 따라 지수 차이 방향이 바뀔 수 있습니다.
              </p>
            )}
            <p>
              A − B 조건부 범위:{' '}
              {formatNumber(result.comparison?.differenceBounds?.lower)} ~{' '}
              {formatNumber(result.comparison?.differenceBounds?.upper)}
            </p>
          </section>
          <section aria-label="분석의 한계">
            <h3>분석의 한계</h3>
            <p>
              조건부 범위는 미분류를 모두 1등급 또는 10등급으로 가정한 값으로
              신뢰구간이 아닙니다. 오분류·공간 오차를 포함하지 않습니다.
            </p>
            <p>
              지도는 생활안전지도 자료를 표시합니다. 점수는 좌표와 반경으로
              생성한 가상 집계로 계산하며, 지도 자료나 지도 이미지를 분석한
              결과가 아닙니다. 실제 범죄 확률이나 도로 길이 비율을 뜻하지
              않습니다.
            </p>
          </section>
        </div>
      </details>
    </dialog>
  )
}

export default CompareResultModal
