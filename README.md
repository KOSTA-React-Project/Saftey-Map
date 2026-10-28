# Saftey-Map · 우리동네 안심지도

공공데이터 API를 활용하여 생활구역 내 범죄주의정보를 제공한다. 또한, 특정 지역 2개를 비교하여 이사나 방문시 지역의 안전정보를 미리 확인할 수 있도록 한다.

## 목차

- [기술 스택](#기술-스택)
- [실행 방법](#실행-방법)
- [역할 분담](#역할-분담)
- [컨벤션](#컨벤션)
  - [폴더·파일](#폴더파일)
  - [컴포넌트](#컴포넌트)
  - [스타일](#스타일)
  - [코드 스타일](#코드-스타일)
  - [환경 변수](#환경-변수)
  - [Git](#git)
  - [공통 파일 수정 규칙](#공통-파일-수정-규칙)

## 기술 스택

- React 19 + Vite
- React Router
- CSS Modules + 디자인 토큰(`src/styles/tokens.css`)
- 지도: Kakao Maps JavaScript SDK (라이브러리 없이 직접 사용)
- 데이터: 공공데이터포털 API

## 실행 방법

```bash
npm install     # 의존성 설치
npm run dev     # 개발 서버 실행 → http://localhost:5173
npm run lint    # 린트 검사
npm run format  # Prettier로 코드 정리
npm run build   # 프로덕션 빌드
```

- `.env.example`을 복사해 `.env`를 만들고 팀에서 공유한 API 키를 넣는다.
- VS Code로 열면 추천 확장(Prettier)을 설치하라는 알림이 뜬다. 설치 후 **Format On Save**를 켜면 저장할 때 자동 정리된다.

## 역할 분담

| 담당 | 화면 | 파일 |
|---|---|---|
| ImHyungsuk | 지도 탐색 메인, 로그인, 회원가입, 공통 레이아웃·디자인 | `ExplorePage`, `LoginPage`, `SignupPage`, `layouts/`, `components/` |
| joohyosung | 두 지역 비교(지점 선택, 결과), 운영 | `CompareSetupPage`, `CompareResultPage`, `AdminPage` |
| yusin-bit | 안심노트(상세, 작성), 정책 | `NoteDetailPage`, `NoteComposePage`, `PolicyPage` |

## 컨벤션

### 폴더·파일

| 위치 | 용도 | 이름 규칙 |
|---|---|---|
| `src/pages/` | 화면 하나 = 파일 하나 | `ExplorePage.jsx` (PascalCase + `Page`) |
| `src/layouts/` | 여러 화면이 같이 쓰는 뼈대 | `MapLayout.jsx` (+ `Layout`) |
| `src/components/layout/` | 상단바, 사이드바 | `Header.jsx` |
| `src/components/ui/` | 공용 버튼, 입력창 등 | `Button.jsx` |
| `src/components/map/` | 지도 관련 | `MapView.jsx` |
| `src/api/` | API 호출 함수 | `crimeApi.js` (camelCase + `Api`) |
| `src/hooks/` | 커스텀 훅 | `useCrimeData.js` (`use` 접두사) |
| `src/utils/` | 순수 함수 | `formatDate.js` |
| `src/constants/` | 상수 | `routes.js` |
| `src/styles/` | 디자인 토큰, 전역 스타일 | `tokens.css` |

- 한 화면에서만 쓰는 조각은 그 페이지 파일 안에 둔다. 다른 화면에서도 쓰게 되면 `components/`로 옮긴다.

### 컴포넌트

- 함수형 컴포넌트만 쓴다. 파일 하나에 컴포넌트 하나, `export default`로 내보낸다.
- props는 매개변수에서 바로 구조 분해한다: `function Sidebar({ children, footer })`
- API 호출은 컴포넌트에서 직접 하지 않고 `api/` 함수나 커스텀 훅을 거친다.
- 주소는 문자열로 직접 쓰지 않고 `ROUTES` 상수를 쓴다: `ROUTES.COMPARE`

**지도 화면(사이드바 + 지도) 페이지 만들기**

```jsx
// 페이지 파일: 사이드바 내용만 작성한다. footer는 하단 고정 영역
<Sidebar footer={<button>같은 조건으로 비교하기</button>}>...</Sidebar>

// App.jsx의 MapLayout 안에 라우트 한 줄 추가
<Route path="compare" element={<CompareSetupPage />} />
```

**지도 컴포넌트** (`src/components/map/`, `src/hooks/useMap.js`)

| 이름 | 하는 일 | 주요 props |
|---|---|---|
| `MapView` | 카카오 지도. 확대·축소·내 위치 버튼 포함 | `center`, `level`(처음 위치), `onClick`, `interactive`, `showControls`, `className` |
| `MapMarker` | 지도 위 마커 | `type`(`'A'`·`'B'`·`'note'`·`'new'`), `position`, `onClick` |
| `MapRadius` | 반경 점선 원 | `center`, `radius`(m) |
| `useMapClick(fn)` | 지도를 누르면 `fn({ lat, lng })` 호출 (MapLayout 화면용) | |
| `useMapCenter(position)` | `position`이 바뀌면 지도 중심 이동 (MapLayout 화면용) | |
| `PlaceSearchBox` (`components/search/`) | 주소·장소명 검색. 결과를 고르면 `onSelect({ lat, lng, label })` | `onSelect`, `placeholder` |
| `searchPlaces(query)` (`utils/placeSearch.js`) | 주소·장소명 검색 결과 `[{ label, address, lat, lng }]` | |
| `getAddress({ lat, lng })` (`utils/geocoder.js`) | 좌표 → 주소 문자열 (없으면 `null`) | |

- 좌표는 항상 `{ lat, lng }` 형태로 쓴다.
- **지도 화면(MapLayout) 페이지**는 지도를 직접 만들지 않는다. 페이지에 `MapMarker` 등을 쓰면 레이아웃 지도에 붙고, 페이지를 이동해도 지도는 유지된다.

```jsx
function CompareSetupPage() {
  const [pointB, setPointB] = useState(null)
  useMapClick(setPointB)

  return (
    <>
      <Sidebar>...</Sidebar>
      <MapMarker type="B" position={pointB} />
      <MapRadius center={pointB} radius={1000} />
    </>
  )
}
```

- **그 밖의 화면**(비교 결과, 노트 작성 등)은 `MapView`를 직접 두고 그 안에 넣는다. 크기는 `className`으로, 클릭은 `onClick`으로 받는다.

```jsx
<MapView className={styles.pickerMap} center={START} onClick={setPosition}>
  <MapMarker type="new" position={position} />
</MapView>
```

### 스타일

- **CSS Modules**(`*.module.css`)만 쓴다. 클래스 이름은 camelCase(`styles.navItem`).
- 색상·간격·글자 크기·모서리는 **`tokens.css` 변수만** 쓴다: `var(--color-primary)`
- 필요한 값이 토큰에 없으면 직접 적지 말고 디자인 담당에게 토큰 추가를 요청한다.
- `global.css`는 디자인 담당만 수정한다.

### 코드 스타일

- 들여쓰기 2칸, 작은따옴표(`'`), 세미콜론 없음. `npm run format`으로 맞춘다.
- import할 때 확장자를 붙인다: `import App from './App.jsx'`
- 주석은 꼭 필요한 곳에만 한국어로 짧게 단다.
- PR 올리기 전에 `npm run lint`가 통과해야 한다.

### 환경 변수

- API 키는 `.env`에만 두고 코드에 직접 적지 않는다.
- 변수 이름은 `VITE_` 접두사를 붙이고(`VITE_KAKAO_MAP_KEY`), `import.meta.env.VITE_...`로 읽는다.
- `.env`는 커밋하지 않는다. 새 키가 생기면 `.env.example`에 **이름만** 추가한다.

### Git

**브랜치**: `main`에서 딴다.

| 접두사 | 용도 | 예시 |
|---|---|---|
| `feature/` | 새 기능 | `feature/compare` |
| `fix/` | 버그 수정 | `fix/header-active-tab` |
| `chore/` | 설정, 구조 변경 | `chore/convention` |

**커밋 메시지**: `타입: 한국어 요약` (예: `feat: 비교 지점 선택 화면 구현`)

| 타입 | 용도 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `style` | 스타일 변경 |
| `refactor` | 동작 변경 없는 코드 개선 |
| `docs` | 문서 |
| `chore` | 설정, 패키지, 기타 |

**PR**

- `main`으로 PR을 올린다. **`main`에 직접 푸시하지 않는다.**
- CodeRabbit 리뷰 확인 + 팀원 **1명 이상 승인** 후 머지한다.
- 머지 방식은 **Merge commit**.
- 작업 중이면 Draft PR로 올린다(CodeRabbit이 리뷰하지 않는다).
- CodeRabbit 리뷰가 이해되지 않으면 댓글로 `@coderabbitai 쉽게 설명해줘`라고 물어본다.

### 공통 파일 수정 규칙

아래 파일은 모두가 같이 써서 충돌이 나기 쉽다. **고치기 전에 팀에 먼저 말한다.**

- `src/App.jsx` (라우트 한 줄 추가는 예외), `src/constants/routes.js`
- `src/layouts/`, `src/components/layout/`, `src/components/ui/`, `src/styles/`

## 공인 IP 공개 배포

- 공개 주소: http://43.203.255.132 (현재 HTTP, HTTPS는 도메인 연결 후 추가)
- Nginx web 컨테이너가 React 화면을 제공하고 /api 요청을 내부 Express API로 전달한다.
- WMS 키는 서버 SAFEMAP_KEY에 설정한다. 프론트의 기존 VITE_SAFEMAP_KEY는 더 이상 사용하지 않는다. 로컬 WMS 사용 시에도 연결된 API 서버에 SAFEMAP_KEY가 필요하다.
- 카카오 JavaScript 키는 브라우저용이며 공개 IP 주소를 Kakao SDK 허용 도메인에 등록한다.
- 배포 구성과 실행 명령: [deploy/README.md](deploy/README.md). GitHub Actions는 현재 CI만 구성되어 있으며 공개 배포는 수동 수행했다.

## CI/CD

작업 브랜치와 PR에서는 검사만 수행하고, main 반영 후 검증한 프론트·API 파일을 EC2로 자동 배포한다.
설정 변수, 배포 순서, 백업·복구 및 제한은 [배포 안내](deploy/README.md)를 참고한다.
배포 스크립트 테스트: `node --test deploy/tests/*.test.mjs`.

## 비교 계산식

- `src/services/colorMetrics.js`: 집계된 1~10등급 픽셀 개수에서 계산하는 순수 함수. WMS 수신/픽셀 분류와 분리.
- 색상 평균 지수 `S = 100 × Σ[(k−1)nₖ] / (9M)`, 8~10등급 비중 `Σ(n₈..n₁₀)/M × 100`.
- 등급별 분포 `nₖ/M × 100`, 판별 성공 비율 `M/T × 100`, 후보 중 미분류 `U/(M+U) × 100`.
- `M=Σnₖ`, `T=M+U+E`. U는 미분류, E는 미표시. 비율 반환 단위는 모두 0~100(%), 화면에서만 반올림.
- M=0이면 점수·분포·높은 등급 비중은 null. T=0은 EMPTY_AREA, 잘못된 개수는 INVALID_DATA. 유효한 전부 1등급의 0점과 구분.
- A−B 지수 및 높은 등급 비중 차이(%p), 미분류의 양 끝 배정에 따른 조건부 지수 범위를 제공. 신뢰구간/안전 순위가 아님.
- 현재 비교 입력은 동일 조건의 가상 fixture이며 `synthetic: true`. 실제 지도 WMS와 계산 데이터는 별개. 실제 PNG 디코딩·색상 분류·지리적 마스크는 이번 변경에 포함하지 않음.
- 반경은 기존 500m/1km 유지(지름 아님). 높은 등급 경계 8은 시험값. 실제 등급 방향·팔레트·해상도·기간·이용 조건 검증 후 실제 집계를 연결해야 함.

```bash
npm run test:compare
npm run test:compare:browser  # Chrome 설치 필요. 다른 Playwright 브라우저 채널은 PLAYWRIGHT_CHANNEL로 지정
npm run lint
npm run build
```

브라우저 테스트는 지도 SDK 키/WMS를 비활성화한 fixture 모달 검증이다. 실제 지도/API 검증을 의미하지 않는다.
