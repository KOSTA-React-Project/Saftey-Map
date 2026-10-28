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

// 장식용 길 — 실제 데이터가 아닌 비슷한 모양
// points: [x, y, 그 지점의 범죄주의구간 등급]. 지점 사이는 색이 자연스럽게 바뀜
// 등급 0은 칠하지 않는 곳 (실제 지도처럼 색이 없는 길도 있게)
const ROADS = [
  // 큰길
  {
    width: 16,
    points: [
      [-10, 198, 0],
      [120, 202, 3],
      [250, 207, 5],
      [380, 211, 7],
      [480, 214, 4],
      [610, 217, 0],
    ],
  },
  {
    width: 16,
    points: [
      [244, -10, 0],
      [247, 100, 3],
      [250, 207, 6],
      [253, 300, 4],
      [256, 372, 2],
      [260, 490, 0],
    ],
  },
  {
    width: 12,
    points: [
      [372, -10, 0],
      [392, 90, 3],
      [420, 211, 6],
      [458, 318, 9],
      [485, 393, 3],
      [520, 490, 0],
    ],
  },
  // 골목
  {
    width: 8,
    points: [
      [-10, 100, 0],
      [140, 98, 0],
      [247, 100, 2],
      [392, 90, 3],
      [610, 86, 0],
    ],
  },
  {
    width: 8,
    points: [
      [-10, 300, 0],
      [130, 302, 3],
      [253, 300, 4],
      [360, 304, 6],
      [458, 318, 9],
      [610, 330, 4],
    ],
  },
  {
    width: 8,
    points: [
      [110, -10, 0],
      [115, 98, 0],
      [120, 202, 1],
      [126, 302, 3],
      [129, 384, 0],
    ],
  },
  {
    width: 8,
    points: [
      [520, -10, 0],
      [526, 86, 0],
      [538, 214, 3],
      [552, 324, 5],
      [559, 353, 0],
    ],
  },
  // 강변길 (강을 따라)
  {
    width: 8,
    points: [
      [-10, 391, 0],
      [60, 382, 0],
      [128, 384, 0],
      [200, 391, 0],
      [258, 394, 0],
      [330, 386, 0],
      [420, 366, 1],
      [490, 356, 2],
      [558, 353, 0],
      [610, 357, 0],
    ],
  },
  // 범죄주의구간이 모인 골목 (일부러 반듯하지 않게)
  {
    width: 5,
    points: [
      [380, 211, 7],
      [372, 258, 8],
      [360, 304, 6],
    ],
  },
  {
    width: 5,
    points: [
      [253, 256, 4],
      [372, 258, 8],
      [440, 266, 10],
      [545, 270, 6],
    ],
  },
  {
    width: 5,
    points: [
      [480, 214, 4],
      [494, 262, 8],
      [505, 322, 7],
    ],
  },
  // 조용한 동네 골목 (대부분 색 없음)
  {
    width: 5,
    points: [
      [120, 150, 0],
      [247, 154, 0],
    ],
  },
  {
    width: 5,
    points: [
      [300, 100, 2],
      [306, 207, 3],
    ],
  },
  {
    width: 5,
    points: [
      [440, 90, 0],
      [456, 150, 2],
      [530, 148, 2],
    ],
  },
]

// 건물 [x, y, 너비, 높이] — 지도 질감을 위한 장식
const BUILDINGS = [
  [140, 22, 34, 26],
  [186, 30, 40, 22],
  [150, 116, 30, 22],
  [194, 112, 34, 26],
  [272, 24, 50, 30],
  [282, 120, 18, 40],
  [318, 122, 48, 30],
  [326, 168, 36, 22],
  [410, 22, 36, 28],
  [450, 108, 34, 24],
  [548, 24, 40, 34],
  [548, 110, 38, 28],
  [20, 120, 70, 26],
  [24, 230, 74, 46],
  [146, 226, 34, 30],
  [192, 222, 38, 22],
  [274, 226, 46, 22],
  [276, 268, 30, 24],
  [396, 226, 26, 22],
  [508, 232, 22, 24],
  [566, 236, 30, 44],
  [402, 282, 30, 18],
  [520, 284, 24, 30],
  [24, 318, 80, 36],
  [272, 318, 70, 34],
  [380, 326, 56, 22],
  [568, 318, 30, 22],
]

// 건물 지붕 색 (높낮이 차이처럼 보이게 돌아가며 사용)
const BUILDING_TONES = ['#f4f2ea', '#e9e6dc', '#efeee6', '#e2e3d9']

// 안심노트 핀 위치 (핀 끝이 가리키는 점)
const NOTE_PINS = [
  [456, 150],
  [300, 301],
]

// 길 하나를 지점별 구간으로 나눔
function segmentsOf(road, roadIndex) {
  return road.points.slice(1).map((end, i) => {
    const start = road.points[i]
    return { id: `auth-crime-${roadIndex}-${i}`, start, end }
  })
}

const SEGMENTS = ROADS.flatMap((road, i) =>
  segmentsOf(road, i)
    .filter(({ start, end }) => start[2] > 0 || end[2] > 0)
    .map((segment) => ({ ...segment, width: road.width })),
)

// 구간 색 단계 [위치, 등급, 불투명도]
// 한쪽이 무색(0)이면 투명 → 아주 연한 노랑(1등급) → 그 등급 색으로 천천히 번지게
function stopsOf(from, to) {
  if (from === 0)
    return [
      [0, 1, 0],
      [0.45, 1, 0.9],
      [1, to, 1],
    ]
  if (to === 0)
    return [
      [0, from, 1],
      [0.55, 1, 0.9],
      [1, 1, 0],
    ]
  return [
    [0, from, 1],
    [1, to, 1],
  ]
}

// 다리 [x1, y1, x2, y2, 길 굵기] — 강을 건너는 큰길 구간
const BRIDGES = [
  [257, 398, 259, 466, 16],
  [475, 365, 496, 422, 12],
]

const pathOf = (points) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')

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
          {/* 구간마다 앞뒤 지점의 등급 색으로 자연스럽게 바뀜 */}
          {SEGMENTS.map(({ id, start, end }) => (
            <linearGradient
              key={id}
              id={id}
              gradientUnits="userSpaceOnUse"
              x1={start[0]}
              y1={start[1]}
              x2={end[0]}
              y2={end[1]}
            >
              {stopsOf(start[2], end[2]).map(([offset, grade, opacity]) => (
                <stop
                  key={offset}
                  offset={offset}
                  stopColor={GRADE_COLORS[grade - 1]}
                  stopOpacity={opacity}
                />
              ))}
            </linearGradient>
          ))}
          <linearGradient id="auth-river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8cc3de" />
            <stop offset="1" stopColor="#5c9dc2" />
          </linearGradient>
          <linearGradient id="auth-park" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b7dcae" />
            <stop offset="1" stopColor="#9acb90" />
          </linearGradient>
          <linearGradient id="auth-pin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d48446" />
            <stop offset="1" stopColor="var(--color-community)" />
          </linearGradient>
          {/* 가장자리를 살짝 어둡게 해 깊이감 */}
          <radialGradient id="auth-vignette" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.6" stopColor="#1e3c2a" stopOpacity="0" />
            <stop offset="1" stopColor="#1e3c2a" stopOpacity="0.14" />
          </radialGradient>
          <filter id="auth-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* 땅 */}
        <rect width="600" height="480" fill="#e9eee5" />

        {/* 공원 (나무 포함) — 강과 겹치지 않게 */}
        <g>
          <rect
            x="10"
            y="12"
            width="90"
            height="76"
            rx="8"
            fill="url(#auth-park)"
          />
          <rect
            x="140"
            y="316"
            width="100"
            height="50"
            rx="8"
            fill="url(#auth-park)"
          />
          <g fill="#7fb874">
            <circle cx="32" cy="36" r="7" />
            <circle cx="56" cy="30" r="6" />
            <circle cx="78" cy="44" r="7" />
            <circle cx="40" cy="64" r="6" />
            <circle cx="70" cy="70" r="5" />
            <circle cx="162" cy="336" r="6" />
            <circle cx="190" cy="346" r="7" />
            <circle cx="218" cy="334" r="6" />
          </g>
        </g>

        {/* 건물: 아래쪽 그림자 + 지붕 */}
        <g>
          {BUILDINGS.map(([x, y, w, h], i) => (
            <g key={`${x}-${y}`}>
              <rect
                x={x + 2}
                y={y + 3}
                width={w}
                height={h}
                rx="3"
                fill="#cdd5c7"
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx="3"
                fill={BUILDING_TONES[i % BUILDING_TONES.length]}
              />
            </g>
          ))}
        </g>

        {/* 강: 둔치 → 물 → 반짝이는 선 */}
        <path
          d="M-20 432C110 396 220 452 330 424S520 382 640 398"
          fill="none"
          stroke="#d6e5cf"
          strokeWidth="60"
        />
        <path
          d="M-20 432C110 396 220 452 330 424S520 382 640 398"
          fill="none"
          stroke="url(#auth-river)"
          strokeWidth="40"
        />
        <path
          d="M-20 426C110 390 220 446 330 418S520 376 640 392"
          fill="none"
          stroke="#c5e2f0"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* 다리: 강물 위 그림자 → 난간 (길은 그 위에 그려짐) */}
        <g fill="none" strokeLinecap="butt">
          {BRIDGES.map(([x1, y1, x2, y2, width]) => (
            <g key={`${x1}-${y1}`}>
              <path
                d={pathOf([
                  [x1 + 4, y1 + 5],
                  [x2 + 4, y2 + 5],
                ])}
                stroke="#1e3c2a"
                strokeOpacity="0.22"
                strokeWidth={width + 8}
              />
              <path
                d={pathOf([
                  [x1, y1],
                  [x2, y2],
                ])}
                stroke="#8e9a8b"
                strokeWidth={width + 8}
              />
            </g>
          ))}
        </g>

        {/* 길: 테두리 → 흰 길 */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {ROADS.map((road) => (
            <path
              key={`edge-${pathOf(road.points)}`}
              d={pathOf(road.points)}
              stroke="#cad2c3"
              strokeWidth={road.width + 3}
            />
          ))}
          {ROADS.map((road) => (
            <path
              key={`road-${pathOf(road.points)}`}
              d={pathOf(road.points)}
              stroke="var(--color-white)"
              strokeWidth={road.width}
            />
          ))}
        </g>

        {/* 범죄주의구간: 길 위에 등급 색을 겹쳐 칠함 */}
        <g
          fill="none"
          strokeLinecap="round"
          opacity="0.82"
          style={{ mixBlendMode: 'multiply' }}
        >
          {SEGMENTS.map(({ id, start, end, width }) => (
            <path
              key={id}
              d={pathOf([start, end])}
              stroke={`url(#${id})`}
              strokeWidth={width + 6}
            />
          ))}
        </g>

        {/* 가장자리 음영 */}
        <rect width="600" height="480" fill="url(#auth-vignette)" />

        {/* 고른 지점(A)과 반경 */}
        <circle
          cx="128"
          cy="202"
          r="82"
          fill="var(--color-primary)"
          fillOpacity="0.1"
          stroke="var(--color-primary)"
          strokeDasharray="7 6"
          strokeWidth="2.5"
        />
        <circle
          cx="128"
          cy="202"
          r="17"
          fill="var(--color-primary)"
          stroke="var(--color-white)"
          strokeWidth="4"
          filter="url(#auth-shadow)"
        />

        {/* 안심노트 핀 마커: 바닥 그림자 + 핀 */}
        {NOTE_PINS.map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <ellipse cy="2" rx="9" ry="3.5" fill="#1e3c2a" opacity="0.2" />
            <path
              d="M0 0C-13-17-20-26-20-35a20 20 0 0 1 40 0c0 9-7 18-20 35z"
              fill="url(#auth-pin)"
              stroke="var(--color-white)"
              strokeWidth="3"
              filter="url(#auth-shadow)"
            />
            <circle cy="-35" r="7" fill="var(--color-white)" />
          </g>
        ))}

        {/* 메모 말풍선 */}
        <g transform="translate(450 18)" filter="url(#auth-shadow)">
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
