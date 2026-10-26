import { useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { MapContext } from '../hooks/useMap.js'
import { CrimeTypeContext } from '../hooks/useCrimeType.js'
import { DEFAULT_CRIME_TYPE } from '../constants/crimeTypes.js'
import CrimeLayer from '../components/map/CrimeLayer.jsx'
import GradeLegend from '../components/map/GradeLegend.jsx'
import MapView from '../components/map/MapView.jsx'
import styles from './MapLayout.module.css'

// 지도는 여기서 한 번만 만들고 페이지를 이동해도 유지됨.
// 페이지는 <Sidebar>와 MapMarker 등만 렌더링하면 이 지도에 붙음
// 범죄 유형은 useCrimeType()으로 페이지에서 바꿀 수 있음 (기본: 전체)
function MapLayout() {
  const [map, setMap] = useState(null)
  const [crimeType, setCrimeType] = useState(DEFAULT_CRIME_TYPE)
  const crimeTypeValue = useMemo(
    () => ({ crimeType, setCrimeType }),
    [crimeType],
  )

  return (
    <MapContext.Provider value={map}>
      <CrimeTypeContext.Provider value={crimeTypeValue}>
        <div className={styles.mapLayout}>
          <div className={styles.sidebarSlot}>
            <Outlet />
          </div>
          <div className={styles.mapArea}>
            <MapView className={styles.map} onCreate={setMap}>
              {/* 출처는 범례 카드 안에 표시 */}
              <CrimeLayer crimeType={crimeType} showAttribution={false} />
              <GradeLegend crimeType={crimeType} />
            </MapView>
          </div>
        </div>
      </CrimeTypeContext.Provider>
    </MapContext.Provider>
  )
}

export default MapLayout
