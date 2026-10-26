# 안심노트 위치 입력 회귀 테스트

```sh
npm ci
npx playwright install chromium
npm test
```

Node.js 22 이상에서 실행합니다. Vite 서버와 Chromium은 테스트가 시작·종료할 때 자동으로 열고 닫습니다.
외부 카카오 SDK만 대체해 응답 순서를 제어하며, 실제 React 화면과 검색·주소 변환·localStorage 저장 코드를 실행합니다.
실제 카카오 API 연결이나 지도 도로 정렬을 검증하는 테스트는 아닙니다.
