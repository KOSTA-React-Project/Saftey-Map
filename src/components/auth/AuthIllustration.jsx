import styles from './AuthIllustration.module.css'

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
        {/* 바탕과 공원 */}
        <rect width="600" height="480" fill="var(--color-map-placeholder)" />
        <path
          d="M40 60h150v110H40zM400 300h170v130H400z"
          fill="var(--color-primary-soft)"
        />

        {/* 강 */}
        <path
          d="M-20 380C120 340 200 420 320 390S520 300 640 330"
          fill="none"
          stroke="#d3e3ea"
          strokeWidth="46"
        />

        {/* 범죄주의구간을 떠올리게 하는 옅은 색 영역 */}
        <circle cx="430" cy="140" r="90" fill="#fee88b" opacity="0.45" />
        <circle cx="455" cy="125" r="45" fill="#fd8d3c" opacity="0.25" />

        {/* 도로: 큰길과 골목 */}
        <g stroke="var(--color-white)" strokeLinecap="round" fill="none">
          <path d="M0 210H600M250 0V480" strokeWidth="18" />
          <path
            d="M0 110H600M0 300H600M120 0V480M370 0V480M500 0V480"
            strokeWidth="8"
          />
        </g>

        {/* 고른 지점(A)과 반경 */}
        <circle
          cx="250"
          cy="210"
          r="95"
          fill="var(--color-primary)"
          fillOpacity="0.08"
          stroke="var(--color-primary)"
          strokeDasharray="6 6"
          strokeWidth="2"
        />
        <circle
          cx="250"
          cy="210"
          r="16"
          fill="var(--color-primary)"
          stroke="var(--color-white)"
          strokeWidth="4"
        />

        {/* 안심노트 핀 마커 */}
        {[
          [190, 150],
          [330, 255],
          [440, 120],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <path
              d="M0 0C-12-16-18-24-18-32a18 18 0 0 1 36 0c0 8-6 16-18 32z"
              fill="var(--color-community)"
              stroke="var(--color-white)"
              strokeWidth="3"
            />
            <circle cy="-32" r="6" fill="var(--color-white)" />
          </g>
        ))}

        {/* 메모 말풍선 */}
        <g transform="translate(350 160)">
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
