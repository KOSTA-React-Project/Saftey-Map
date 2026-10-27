# 공인 IP 웹 공개

현재 공개 주소는 http://43.203.255.132 이다. HTTPS는 도메인 준비 후 별도 연결한다.

## 구성
- web: Nginx가 React dist를 80번에서 제공. React 라우트 직접 접근은 index.html로 연결.
- /api/*: Docker 내부 api:3000으로 전달. API/MySQL은 기존 loopback 포트 유지.
- Nginx는 X-Forwarded-For를 실제 접속 IP로 덮어쓰며 API TRUST_PROXY=1로 요청 제한을 사용자별 적용.
- FRONTEND_ORIGINS에 공개 HTTP 주소 추가. 현재 HTTP 검증에서는 COOKIE_SECURE=false. HTTPS 연결 시 true로 전환.
- WMS 키는 서버 SAFEMAP_KEY에서만 사용. 브라우저는 /api/public-data/crime-image, /crime-legend를 호출.
- 카카오 JavaScript 키는 공개 브라우저용이며 Kakao 콘솔에 공개 주소 등록이 필요.

## 빌드와 전달
프로젝트 루트에서 npm ci, npm ci --prefix server, npm run test:api, npm run lint, npm run build 실행.
프론트 dist, deploy/web/Dockerfile, deploy/web/nginx.conf를 EC2 app/web에 배치한다. 서버 소스/lockfile은 app/server에 배치한다.
deploy/compose.web.yaml을 기존 compose.yaml/compose.api.yaml과 같은 /home/ubuntu/ansim-infra에 둔다.
.env, SSH 키, DB 비밀번호는 배포 파일에 포함하지 않는다. EC2 shared/api.env는 별도 보관한다.

```bash
cd /home/ubuntu/ansim-infra
docker compose -f compose.yaml -f compose.api.yaml -f compose.web.yaml config --quiet
docker compose -f compose.yaml -f compose.api.yaml -f compose.web.yaml build api web
docker compose -f compose.yaml -f compose.api.yaml -f compose.web.yaml up -d --no-deps api web
docker compose -f compose.yaml -f compose.api.yaml -f compose.web.yaml ps
```

API 재생성 후에도 Nginx가 Docker DNS를 다시 조회한다. DB 컨테이너/볼륨 삭제 명령은 사용하지 않는다.

## 이번 수동 배포 백업
EC2 /home/ubuntu/ansim-infra/backups/public-web-2a901d9ff93c 에 기존 코드, 기존 API 이미지 태그, 원래 api.env를 보관했다. 설정 백업에는 비밀값이 있으므로 공유/커밋하지 않는다.
state.json과 rollback.yaml을 참고해 복구한다. 웹 중지 및 이전 API 복구는 필요할 때만 수행한다.

## 확인 범위
외부 HTTP 접속, React 직접 경로, DB health, 비회원 관리자 차단, 실제 WMS 이미지/범례를 확인한다.
회원 생성/관리자 승격/메모 쓰기는 자동 검증으로 수행하지 않는다. HTTPS/현재 위치 권한은 별도 단계다.

## GitHub Actions 자동 배포
1. 작업 브랜치 push 또는 main 대상 PR: 의존성 설치 → lint → API 테스트 → 배포 스크립트 테스트 → React 빌드.
2. main push 또는 main에서 수동 실행: 위 검사를 통과한 dist와 서버 소스를 artifact로 보관한 뒤 EC2에 전달.
3. EC2에서 이전 소스/이미지를 backups/<release>에 보관하고 api/web만 빌드·교체한다. DB 컨테이너, 볼륨, shared/api.env는 변경하지 않는다.
4. 웹/API/DB 연결 및 릴리스 ID 확인 실패 시 이전 소스와 이미지로 복구하고 Actions를 실패 처리한다. 복구 자체 실패는 수동 확인이 필요하다.

GitHub Settings → Secrets and variables → Actions:
- Secrets: EC2_HOST, EC2_USER, EC2_SSH_KEY (기존 등록값 사용).
- Variables: VITE_KAKAO_MAP_KEY, EC2_KNOWN_HOSTS (접속을 확인한 SSH 호스트 공개키).
- WMS 키·DB 비밀번호·JWT_SECRET은 EC2 shared/api.env에만 보관한다.

SSH 호스트키가 바뀌면 신뢰할 수 있는 경로에서 서버를 확인한 뒤 EC2_KNOWN_HOSTS를 갱신한다. 호스트 확인을 끄지 않는다.
같은 서버 배포는 GitHub concurrency와 EC2 flock으로 직렬화한다. main 실행은 새 push 때문에 중도 취소하지 않는다.
백업과 릴리스 파일은 자동 삭제하지 않는다. 디스크 사용량을 확인하고 보관 정책은 추후 정한다.
현재 배포는 SSH 및 서버의 Docker 빌드 방식이며 HTTPS/무중단 배포는 후속 작업이다.

로컬 검사:
```bash
bash -n deploy/package-release.sh
bash -n deploy/ec2-deploy.sh
node --test deploy/tests/*.test.mjs
```
