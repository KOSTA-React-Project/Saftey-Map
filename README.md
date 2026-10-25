# Saftey-Map · 우리동네 안심노트

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
- 지도: Kakao Map (연동 예정)
- 데이터: 공공데이터포털 API

## 실행 방법

```bash
npm install     # 의존성 설치
npm run dev     # 개발 서버 실행 → http://localhost:5173
npm run lint    # 린트 검사
npm run format  # Prettier로 코드 정리
npm run build   # 프로덕션 빌드
```

- 프로젝트 루트에 `.env`를 만들고 팀에서 공유한 API 키를 넣는다.
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
