import { useEffect, useRef, useState } from 'react'
import MapView from '../components/map/MapView.jsx'
import MapMarker from '../components/map/MapMarker.jsx'
import MapRadius from '../components/map/MapRadius.jsx'
import styles from './CompareSetupPage.module.css'

function CompareResultModal({ result, onClose }) {
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
            동일 반경 {result.conditions.radius}m · 동일 지도 축척 · 실제 WMS
            미연결
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
              <p>
                위도 {point.lat.toFixed(5)} / 경도 {point.lng.toFixed(5)}
              </p>
              <MapView
                center={point}
                level={
                  result.conditions.radius === 500
                    ? 4
                    : result.conditions.radius === 1000
                      ? 5
                      : 6
                }
                interactive={false}
                showControls={false}
                className={styles.resultMap}
              >
                <MapMarker type={slot} position={point} />
                <MapRadius center={point} radius={result.conditions.radius} />
              </MapView>
              <span className={styles.badge}>색상 분포 요약 지수 · 예시</span>
              <p className={styles.score}>
                {data.score.toFixed(1)}
                <small> / 100</small>
              </p>
              <p>공식 안전등급·범죄 발생 확률이 아닙니다.</p>
              <h4>유효 등급 픽셀 내 분포</h4>
              <div
                className={styles.distribution}
                aria-label="가상 1~10등급 분포"
              >
                {data.distribution.map((value, index) => (
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
                {data.distribution.map((value, index) => (
                  <li key={index}>
                    {index + 1}등급 <strong>{value.toFixed(1)}%</strong>
                  </li>
                ))}
              </ol>
              <div className={styles.metric}>
                <span>주의구간 표시 비율 · 예시</span>
                <strong>{data.displayRatio.toFixed(1)}%</strong>
              </div>
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
      <details className={styles.notice}>
        <summary>산식·분석 기준 확인</summary>
        <p>
          가상 등급 i의 가중치 (i−1)/9 × 100을 유효 등급 픽셀 개수로 가중 평균한
          미확정 제안 산식입니다. 분포의 분모는 유효 등급 픽셀, 표시 비율의
          분모는 미분류·미표시를 포함한 전체 픽셀입니다. 지도에 보이는 색이나
          원을 분석한 결과가 아니며 실제 도로 길이·범죄 비율과 다릅니다. 공식
          등급 방향·이용 조건 검증 전 실제 지수 기능은 비활성 상태입니다.
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
