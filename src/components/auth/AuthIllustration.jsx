import styles from './AuthIllustration.module.css'

// 범죄주의구간 1~10등급 색 (생활안전지도 범례 /api/public-data/crime-legend 값을 옮겨 옴)
const GRADE_COLORS = [
  '#ffffb2',
  '#fee88b',
  '#fed165',
  '#fdb751',
  '#fd9b43',
  '#fa7a35',
  '#f45629',
  '#ea3420',
  '#d31a23',
  '#bd0026',
]

// 장식용 길 [경로, 굵기, 범죄주의구간 등급] — 실제 데이터가 아닌 비슷한 모양
// 실제 지도처럼 대부분 길이 노랑, 길이 촘촘한 곳에 주황·빨강이 모이게 배치
const ROADS = [
  // 큰길
  ['M0 210H250', 18, 3],
  ['M250 210H600', 18, 5],
  ['M250 0V210', 18, 2],
  ['M250 210V480', 18, 4],
  // 골목
  ['M0 110H600', 10, 2],
  ['M0 300H380', 10, 3],
  ['M380 300H600', 10, 7],
  ['M120 0V480', 10, 2],
  ['M370 0V300', 10, 4],
  ['M500 0V210', 10, 3],
  // 촘촘한 동네 (주황·빨강)
  ['M380 240H600', 5, 8],
  ['M380 270H600', 5, 9],
  ['M410 210V330', 5, 7],
  ['M440 210V330', 5, 10],
  ['M470 210V330', 5, 8],
  ['M530 210V330', 5, 6],
  ['M560 210V330', 5, 7],
  // 위쪽 작은 길 (노랑)
  ['M20 160H230', 5, 1],
  ['M60 110V210', 5, 2],
  ['M180 110V210', 5, 1],
  ['M290 60H600', 5, 2],
  ['M430 0V110', 5, 3],
]

// 안심노트 핀 위치 (핀 끝이 가리키는 점)
const NOTE_PINS = [
  [175, 160],
  [330, 262],
]

// 로그인·회원가입 화면 왼쪽 장식 그림 — 지도 위에 안심노트 마커가 꽂힌 모습
// 실제 지도(SDK)를 불러오지 않아 가볍고, 영역 크기에 맞춰 잘려서 채워짐
function AuthIllustration({ className }) {
  return (
    <div className={`${styles.illustration} ${className ?? ''}`}>
      <svg
        className={styles.svg}
        viewBox="0 0 600 480"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* 범죄주의구간 색이 길 주변으로 번져 보이게 */}
          <filter
            id="auth-crime-glow"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* 바탕, 공원, 강 */}
        <rect width="600" height="480" fill="#e4eae0" />
        <path d="M20 20h80v70H20zM140 330h90v120h-90z" fill="#b3d7aa" />
        <path
          d="M-20 410C120 370 200 450 320 420S520 350 640 380"
          fill="none"
          stroke="#8fc2db"
          strokeWidth="44"
        />

        {/* 길 */}
        <g stroke="var(--color-white)" strokeLinecap="round" fill="none">
          {ROADS.map(([d, width]) => (
            <path key={d} d={d} strokeWidth={width} />
          ))}
        </g>

        {/* 범죄주의구간: 길을 따라 등급 색 */}
        <g
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
          filter="url(#auth-crime-glow)"
        >
          {ROADS.map(([d, width, grade]) => (
            <path
              key={d}
              d={d}
              stroke={GRADE_COLORS[grade - 1]}
              strokeWidth={width + 10}
            />
          ))}
        </g>

        {/* 고른 지점(A)과 반경 */}
        <circle
          cx="250"
          cy="210"
          r="95"
          fill="var(--color-primary)"
          fillOpacity="0.12"
          stroke="var(--color-primary)"
          strokeDasharray="7 6"
          strokeWidth="2.5"
        />
        <circle
          cx="250"
          cy="210"
          r="17"
          fill="var(--color-primary)"
          stroke="var(--color-white)"
          strokeWidth="4"
        />

        {/* 안심노트 핀 마커 */}
        {NOTE_PINS.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <path
              d="M0 0C-13-17-20-26-20-35a20 20 0 0 1 40 0c0 9-7 18-20 35z"
              fill="var(--color-community)"
              stroke="var(--color-white)"
              strokeWidth="3"
            />
            <circle cy="-35" r="7" fill="var(--color-white)" />
          </g>
        ))}

        {/* 메모 말풍선 */}
        <g transform="translate(350 150)">
          <path
            d="M0 0h120a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H34l-14 14V64H10A10 10 0 0 1 0 54V10A10 10 0 0 1 10 0z"
            fill="var(--color-white)"
            stroke="var(--color-border)"
          />
          <rect
            x="14"
            y="16"
            width="74"
            height="8"
            rx="4"
            fill="var(--color-community)"
            opacity="0.7"
          />
          <rect
            x="14"
            y="34"
            width="100"
            height="6"
            rx="3"
            fill="var(--color-secondary)"
            opacity="0.35"
          />
          <rect
            x="14"
            y="46"
            width="64"
            height="6"
            rx="3"
            fill="var(--color-secondary)"
            opacity="0.35"
          />
        </g>
      </svg>
    </div>
  )
}

export default AuthIllustration
