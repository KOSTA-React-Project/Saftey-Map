import { useMap } from '../../hooks/useMap.js'
import styles from './MapControls.module.css'

// 확대·축소, 내 위치 버튼. MapView 안에서 자동으로 표시됨
function MapControls() {
  const map = useMap()

  const zoom = (delta) =>
    map.setLevel(map.getLevel() + delta, { animate: true })

  const moveToMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        map.panTo(
          new window.kakao.maps.LatLng(coords.latitude, coords.longitude),
        ),
      () =>
        window.alert(
          '현재 위치를 확인할 수 없어요. 위치 권한을 확인해 주세요.',
        ),
    )
  }

  return (
    <div className={styles.controls}>
      <div className={styles.zoomGroup}>
        <button
          type="button"
          className={styles.button}
          onClick={() => zoom(-1)}
          aria-label="확대"
        >
          +
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => zoom(1)}
          aria-label="축소"
        >
          −
        </button>
      </div>
      <button
        type="button"
        className={`${styles.button} ${styles.single}`}
        onClick={moveToMyLocation}
        aria-label="내 위치로 이동"
      >
        <svg viewBox="0 0 20 20" className={styles.icon} aria-hidden="true">
          <circle cx="10" cy="10" r="7" />
          <circle cx="10" cy="10" r="3" />
        </svg>
      </button>
    </div>
  )
}

export default MapControls
