import { useEffect, useRef, useState } from 'react'
import MapView from '../components/map/MapView.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import CrimeLayer from '../components/map/CrimeLayer.jsx'
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
          <p className={styles.eyebrow}>COMPARE / 02 · 예시 결과</p>
          <h2 id="compare-result-title">두 동네를 같은 반경으로 나란히</h2>
          <p>
            동일 반경 {result.conditions.radius}m · 동일 지도 축척 ·
            생활안전지도 WMS 중첩 · 아래 분석 수치는 별도 예시
          </p>
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
              aria-label={`${slot} 지역 예시 결과`}
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
              <span className={styles.badge}>색상 평균 지수 · 예시</span>
              <p className={styles.score}>
                {formatNumber(data.score)}
                {data.score != null && <small> / 100</small>}
              </p>
              <p>공식 안전등급·범죄 발생 확률이 아닙니다.</p>
              <div className={styles.metric}>
                <span>8~10등급 색상 비중 · 예시</span>
                <strong>{formatNumber(data.highGradeRatio, '%')}</strong>
              </div>
              <p>판별된 픽셀 기준 · 8등급 경계는 자체 시험 기준입니다.</p>
              {data.status !== 'OK' && (
                <p role="status">
                  판별된 자료가 없어 지수를 제공하지 않습니다.
                </p>
              )}
              <h4>판별된 등급 픽셀 내 분포 · 예시</h4>
              <div
                className={styles.distribution}
                aria-label="가상 1~10등급 분포"
              >
                {(data.distribution ?? []).map((value, index) => (
                  <span
                    key={index}
                    style={{
                      width: `${value}%`,
                      background: `var(--color-grade-${index + 1})`,
                    }}
                  />
                ))}
              </div>
              <ol className={styles.gradeList}>
                {(data.distribution ?? []).map((value, index) => (
                  <li key={index}>
                    {index + 1}등급 <strong>{value.toFixed(1)}%</strong>
                  </li>
                ))}
              </ol>
              <div className={styles.metric}>
                <span>판별 성공 비율 · 예시</span>
                <strong>{formatNumber(data.displayRatio, '%')}</strong>
              </div>
              <div className={styles.metric}>
                <span>후보 중 미분류 비율 · 예시</span>
                <strong>{formatNumber(data.unclassifiedRatio, '%')}</strong>
              </div>
              <p>
                판별 성공 비율의 분모는 전체 픽셀, 미분류 비율의 분모는 판별
                성공 + 미분류 픽셀입니다.
              </p>
              <p>
                유효 {data.valid} / 전체 {data.total} 가상 픽셀 · 미분류{' '}
                {data.unclassified} · 미표시 {data.unpainted}
              </p>
              <p>
                미표시 영역은 안전 지역으로 해석하지 않습니다. 주민 메모는
                지수에 반영하지 않습니다.
              </p>
            </section>
          )
        })}
      </div>
      <section className={styles.notice} aria-label="A/B 예시 지수 차이">
        <h3>A/B 차이 · 예시</h3>
        <p>
          A − B 색상 평균 지수:{' '}
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
          <p>미분류 색상의 배정에 따라 지수 차이 방향이 바뀔 수 있습니다.</p>
        )}
      </section>
      <details className={styles.notice}>
        <summary>산식·분석 기준 확인</summary>
        <p>
          색상 평균 지수 S = 100 × Σ[(k−1) × nₖ] ÷ (9 × M). 등급 간격을 동일하게
          처리한 자체 요약이며, 높은 지수가 범죄 확률을 뜻하지 않습니다.
          8~10등급 비중은 (n₈+n₉+n₁₀)/M, 등급별 분포는 nₖ/M, 판별 성공 비율은
          M/T, 후보 중 미분류 비율은 U/(M+U)입니다. 비율은 %로 표시합니다. M은
          판별 성공, U는 미분류, E는 미표시, T=M+U+E입니다. M=0이면
          지수·분포·높은 등급 비중을 제공하지 않습니다. 아래 범위는 U를 모두
          1등급 또는 모두 10등급으로 가정한 결과로, 신뢰구간이 아니며
          오분류·공간 오차를 포함하지 않습니다. 지도는 생활안전지도 WMS를
          표시하지만 계산은 별도의 가상 집계로 수행합니다. 실제 도로 길이·범죄
          비율이 아니며, 공식 등급 방향·색상 매핑·이용 조건 검증 전 실제 이미지
          분석은 미연결 상태입니다.
        </p>
        {['A', 'B'].map((slot) => (
          <p key={slot}>
            {slot} 미분류 조건부 지수 범위:{' '}
            {formatNumber(result[slot].scoreBounds?.lower)}
            {' ~ '}
            {formatNumber(result[slot].scoreBounds?.upper)}
          </p>
        ))}
        <p>
          A − B 조건부 범위:{' '}
          {formatNumber(result.comparison?.differenceBounds?.lower)}
          {' ~ '}
          {formatNumber(result.comparison?.differenceBounds?.upper)}
        </p>
      </details>
      <p className={styles.notice}>
        가상 fixture · 실제 관측 기간 없음 · 조회 시각{' '}
        {new Date(result.queriedAt).toLocaleString('ko-KR')} · {result.version}
      </p>
    </dialog>
  )
}

export default CompareResultModal
