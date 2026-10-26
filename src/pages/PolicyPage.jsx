import styles from './PolicyPage.module.css'

// 이용 안내 — 로그인·DB 없이 누구나 볼 수 있는 정적 페이지
const SECTIONS = [
  {
    title: '공공데이터 안내',
    body: '지도에 표시하는 공공정보는 제공기관의 자료를 바탕으로 합니다. 자료의 범위·기준 시점에 따라 실제 현장 상황과 차이가 있을 수 있습니다.',
  },
  {
    title: '지도 분석 결과 안내',
    body: (
      <>
        지도에 표시되는 자체 분석 결과는 지역을 비교하기 위한{' '}
        <strong>참고 지표</strong>입니다. 실제 범죄 발생 건수·범죄 확률 또는
        공식 안전등급으로 해석하면 안 됩니다.
      </>
    ),
  },
  {
    title: '주민 안심노트 안내',
    body: (
      <>
        안심노트는 주민이 직접 관찰한 내용을 기록한 것입니다.{' '}
        <strong>관리자 검토 후 승인된 글만 공개</strong>하지만, 승인이 내용의
        사실 여부나 정확성을 보증하는 것은 아닙니다. 안심노트는 공공데이터 분석
        점수에 합산하지 않습니다.
      </>
    ),
  },
]

const FOOTER_ITEMS = [
  {
    label: '데이터 출처',
    text: '생활안전지도 등 실제 연동·이용 조건이 검증된 공공자료의 출처를 표시합니다.',
  },
  {
    label: '기준 기간·갱신 정보',
    text: '원천자료에서 확인되는 경우에만 실제 기준 시점을 표시하고, 서비스 조회 시각과 구분합니다.',
  },
  {
    label: '공식 안내',
    text: '확인된 제공기관의 공식 안내 페이지로 연결합니다.',
  },
]

function PolicyPage() {
  return (
    <article className={styles.page}>
      <h1 className={styles.title}>이용 안내</h1>
      <p className={styles.intro}>
        우리동네 안심지도는 공공 생활안전 정보와 주민이 작성한 안심노트를 함께
        살펴볼 수 있는 <strong>참고용 서비스</strong>입니다.
      </p>

      <ol className={styles.sections}>
        {SECTIONS.map(({ title, body }, index) => (
          <li key={title} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.number}>
                {String(index + 1).padStart(2, '0')}
              </span>
              {title}
            </h2>
            <p className={styles.body}>{body}</p>
          </li>
        ))}
      </ol>

      <aside className={styles.warning}>
        <strong>꼭 알아두세요</strong>
        <p>
          지도 분석 결과나 주민 메모만으로 특정 지역이 안전하거나 위험하다고
          단정하지 마세요. 중요한 판단을 내릴 때는 현장 상황과 최신 공식 정보를
          함께 확인해 주세요.
        </p>
      </aside>

      <dl className={styles.footer}>
        {FOOTER_ITEMS.map(({ label, text }) => (
          <div key={label} className={styles.footerItem}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default PolicyPage
