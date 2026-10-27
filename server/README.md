# 안심노트 로컬 백엔드

Node.js + Express + MySQL로 동작한다. 서버 뼈대·DB 연결·Docker는 팀 서버(`server/src/index.js`, `server/src/db.js`, `server/Dockerfile`)를 그대로 쓰고, 안심노트 API는 `server/src/notes/`에 둔다.
테이블은 전달받은 **users, notes 두 개만** 사용한다.

## 현재 상태

- 노트 저장, 승인·반려·숨김, 승인된 노트 목록·상세 API 구현.
- 프론트는 localStorage 대신 HTTP API 사용. 메인 지도에서 별도 조회 버튼 없이 승인된 노트 표시.
- 메인 지도는 진입 시, 탭 복귀 시, 표시 중 30초마다 갱신한다. 마커를 누르면 지도 옆에 해당 노트 상세를 표시한다.
- 로그인 화면 이동은 아직 구현하지 않았다. 회원가입·로그인 기능은 담당 팀원의 인증 미들웨어와 연결한다.
- **실제 DB는 아직 생성·연결하지 않았다.** 자동 테스트는 실제 Express HTTP API와 브라우저를 실행하고 DB 경계만 메모리 저장소로 대체한다. 외부 카카오 SDK도 테스트용으로 대체한다. MySQL 저장·재시작 후 유지·실제 지도 SDK 동작을 검증했다고 해석하면 안 된다.

## 로컬 연결 순서

1. 로컬 MySQL에서 프로젝트용 빈 DB를 준비한다. 예시 이름은 `ansim_note`(server/.env.example 기준)이며 기존 실습 DB를 재사용할 필요는 없다.
2. 해당 DB를 선택하고 `server/sql/schema.sql`을 실행한다. 스크립트는 DB 생성·테이블 삭제·회원 데이터 변경을 하지 않는다.
3. 회원 담당자가 이미 `users`를 생성했다면, `users.id`와 `notes.author_id`의 타입 및 `UNSIGNED`를 먼저 맞추고 `notes` 부분만 적용한다. 현재 SQL의 ID 타입은 `INT UNSIGNED`를 제안한 것이다.
4. `server/.env.example`을 `server/.env`로 복사하고 DB 접속 값을 채운다. 서버 접속정보에는 `VITE_` 접두사를 사용하지 않는다.
5. 프로젝트 루트에서 각각 실행한다.

```powershell
npm install && npm --prefix server install
npm run dev:server
```

다른 터미널:

```powershell
npm run dev
```

기본 API 주소는 `http://127.0.0.1:3000`이다. Vite 개발 서버가 `/api`를 이 주소로 전달한다.
서버 연결의 MySQL 세션 시간대는 UTC로 맞추며, 화면은 사용자 지역 시간으로 표시한다.
프론트가 5173 이외의 포트를 사용한다면 `server/.env`의 `FRONTEND_ORIGINS`에도 실제 주소를 추가한다.
프론트 카카오 지도 키와 등록 도메인은 기존 프로젝트 `.env` 설정을 사용한다.

## 로그인 완료 전 로컬 개발 사용자

기본 설정은 인증이 연결되지 않은 작성·관리자 요청을 거절한다. 프론트의 로그인 화면 안내는 별도 작업이다.

로컬에서 승인 흐름을 확인하려면 **이 프로젝트 개발 DB에만** 테스트 사용자를 준비한 뒤,
`server/.env`에 `NODE_ENV=development`, `DEV_AUTH_ENABLED=true`, `DEV_USER_ID=<실제 users.id>`를 설정한다.
서버는 해당 ID로 DB에서 role을 조회한다. 관리자 화면 테스트에는 `ADMIN` 역할이 필요하다.
기존 회원을 관리자로 바꾸거나 테스트 사용자를 자동 생성하지 않는다.

아직 회원 기능이 없을 때 사용할 수 있는 수동 테스트 사용자 예시:

```sql
INSERT INTO users (email, nickname, password_hash, role)
VALUES ('notes-local@example.invalid', '안심노트 로컬 테스트', '!LOGIN_DISABLED_LOCAL_FIXTURE!', 'ADMIN');
SELECT id FROM users WHERE email = 'notes-local@example.invalid';
```

이는 로그인 가능한 계정이 아닌 로컬 노트 테스트용 행이다. 사용자 입력으로 ID/역할을 보내는 방식은 사용하지 않는다.
개발 사용자 연결은 loopback 서버·로컬 요청·명시적인 development 모드에서만 허용된다.

## 로그인 담당자 연결 계약

`server/src/index.js`의 `authenticate`를 실제 로그인 담당자의 미들웨어로 교체한다.
서버에서 검증한 세션 또는 JWT를 통해 `req.user = { id: 정수, role: 'USER' | 'ADMIN' }`를 제공하면 된다.
`server/src/notes/router.js`의 `createNotesRouter`를 기존 Express 서버에 `/api`로 mount할 수도 있다.
로그인 담당자의 쿠키·CSRF·세션 만료 정책도 함께 맞춘다. 브라우저 역할 값이나 요청 본문의 authorId는 신뢰하지 않는다.

## API 계약

| 요청 | 권한 | 결과 |
|---|---|---|
| `POST /api/notes` | 회원 | 내용·좌표를 `PENDING`으로 저장, `{id, status}` 반환 |
| `GET /api/notes` | 공개 | `APPROVED` 마커 목록 |
| `GET /api/notes/:id` | 공개 | 승인된 노트의 제목·내용·날짜·위치 |
| `GET /api/admin/notes?status=PENDING` | 관리자 | 해당 상태 목록. `status=`는 전체 |
| `PATCH /api/admin/notes/:id/status` | 관리자 | `{status, reason, expectedStatus}`로 처리 |

작성 입력은 `{title, content, tag, observedDate, locationName, latitude, longitude, agreed: true}`이다.
제목 60자, 내용 1,000자, 태그 20자, 위치명 255자, 사유 500자 이하다.
관찰 날짜는 실제 날짜여야 하며 한국 기준 오늘 이후는 거절한다. 좌표는 유한한 유효 위경도여야 한다.
작성자·초기 상태는 서버가 결정한다. SQL 값은 매개변수로 전달한다.

기존 관리자 화면과 맞춰 `PENDING → APPROVED/REJECTED`, `APPROVED → HIDDEN`, `HIDDEN → APPROVED`를 지원한다.
처리 시 현재 상태를 조건으로 UPDATE하므로 다른 관리자가 먼저 처리했다면 409를 반환한다.
최근 사유와 시간은 **notes.moderation_reason, notes.updated_at**에만 기록한다. 과거 이력·처리자 기록을 위한 별도 테이블은 없다.
공개 응답에는 작성자·관리자 사유를 포함하지 않는다. 승인 여부와 관계없이 위험도 계산에는 사용하지 않는다.

## 검증

```powershell
npm test
npm run lint
npm run build
```

API만 확인: `npm run test:api`.

참고 API 문서: [Express](https://expressjs.com/en/5x/api/), [mysql2](https://sidorares.github.io/node-mysql2/docs).
