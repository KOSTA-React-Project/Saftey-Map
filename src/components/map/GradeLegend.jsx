import { useEffect, useState } from 'react'
import { useMatch } from 'react-router'
import { fetchCrimeLegend } from '../../api/crimeApi.js'
import { ROUTES } from '../../constants/routes.js'
import { useMapLevel } from '../../hooks/useMap.js'
import { MAX_LEVEL } from './CrimeLayer.jsx'
import {
  DEFAULT_CRIME_TYPE,
  findCrimeType,
} from '../../constants/crimeTypes.js'
import styles from './GradeLegend.module.css'

// 범죄주의구간 범례 카드. 출처 표시(공공누리 4유형)도 여기서 함께 보여 줌
// 유형별 색은 모두 같은 10등급이라, 유형은 제목에만 표시
function GradeLegend({ crimeType = DEFAULT_CRIME_TYPE }) {
  const type = findCrimeType(crimeType)
  const [grades, setGrades] = useState(null)
  const [failed, setFailed] = useState(false)
  const level = useMapLevel()
  const layerHidden = level !== null && level > MAX_LEVEL
  // 비교 화면에는 안심노트 마커가 없어 범죄주의구간만 안내
  const showsNotes = !useMatch(ROUTES.COMPARE)

  useEffect(() => {
    let active = true
    fetchCrimeLegend().then(
      (result) => active && setGrades(result),
      () => active && setFailed(true),
    )
    return () => {
      active = false
    }
  }, [])

  return (
    <section className={styles.legend} aria-label="범죄주의구간 범례">
      <h3 className={styles.title}>
        범죄주의구간 범례
        {type.id !== DEFAULT_CRIME_TYPE && ` · ${type.label}`}
      </h3>
      {grades ? (
        <div className={`${styles.bar} ${layerHidden ? styles.dimmed : ''}`}>
          {grades.map(({ grade, color }) => (
            <span
              key={grade}
              className={styles.step}
              style={{ background: color }}
              title={`${grade}등급`}
            />
          ))}
        </div>
      ) : (
        <p className={styles.status}>
          {failed ? '범례를 불러오지 못했어요.' : '범례를 불러오고 있어요…'}
        </p>
      )}
      <div className={styles.labels}>
        <span>1등급</span>
        <span>10등급</span>
      </div>
      {layerHidden && (
        <p className={styles.notice} role="status">
          지도를 확대하면{' '}
          {showsNotes ? '범죄주의구간과 안심노트가' : '범죄주의구간이'} 보여요.
        </p>
      )}
      <p className={styles.source}>출처: 생활안전지도(경찰청)</p>
    </section>
  )
}

export default GradeLegend
