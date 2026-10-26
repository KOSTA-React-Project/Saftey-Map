import { useEffect, useState } from 'react'
import { fetchCrimeLegend } from '../../api/crimeApi.js'
import styles from './GradeLegend.module.css'

// 범죄주의구간 범례 카드. 출처 표시(공공누리 4유형)도 여기서 함께 보여 줌
function GradeLegend() {
  const [grades, setGrades] = useState(null)
  const [failed, setFailed] = useState(false)

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
      <h3 className={styles.title}>범죄주의구간 범례</h3>
      {grades ? (
        <div className={styles.bar}>
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
      <p className={styles.source}>출처: 생활안전지도(경찰청)</p>
    </section>
  )
}

export default GradeLegend
