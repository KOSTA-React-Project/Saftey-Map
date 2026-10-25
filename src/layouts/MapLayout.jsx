import { useState } from 'react'
import { Outlet } from 'react-router'
import { MapContext } from '../hooks/useMap.js'
import MapView from '../components/map/MapView.jsx'
import styles from './MapLayout.module.css'

// 지도는 여기서 한 번만 만들고 페이지를 이동해도 유지됨.
// 페이지는 <Sidebar>와 MapMarker 등만 렌더링하면 이 지도에 붙음
function MapLayout() {
  const [map, setMap] = useState(null)

  return (
    <MapContext.Provider value={map}>
      <div className={styles.mapLayout}>
        <div className={styles.sidebarSlot}>
          <Outlet />
        </div>
        <div className={styles.mapArea}>
          <MapView className={styles.map} onCreate={setMap} />
        </div>
      </div>
    </MapContext.Provider>
  )
}

export default MapLayout
