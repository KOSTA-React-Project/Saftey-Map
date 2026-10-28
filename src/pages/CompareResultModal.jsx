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
          <p className={styles.eyebrow}>COMPARE / 02</p>
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
          const point = result.conditions[slot]
          return (
            <section
              key={slot}
              id={`result-${slot}`}
              aria-label={`${slot} 지역 지도`}
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
              <p>
                반경 {result.conditions.radius === 500 ? '500m' : '1km'} 안의
                범죄주의구간을 확인하세요. 미표시 영역은 안전 지역으로 해석하지
                않습니다.
              </p>
            </section>
          )
        })}
      </div>
    </dialog>
  )
}

export default CompareResultModal
