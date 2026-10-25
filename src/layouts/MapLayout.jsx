import { Outlet } from 'react-router'
import MapView from '../components/map/MapView.jsx'
import styles from './MapLayout.module.css'

// 각 페이지는 <Sidebar>로 감싼 사이드바 내용만 렌더링하고, 지도는 여기서 유지됨
function MapLayout() {
  return (
    <div className={styles.mapLayout}>
      <div className={styles.sidebarSlot}>
        <Outlet />
      </div>
      <div className={styles.mapArea}>
        <MapView className={styles.map} />
      </div>
    </div>
  )
}

export default MapLayout
