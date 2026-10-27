#!/usr/bin/env bash
set -Eeuo pipefail
release=${1:?release ID required}
[[ "$release" =~ ^[a-zA-Z0-9_-]{1,100}$ ]] || exit 2
root=${ANSIM_DEPLOY_ROOT:-/home/ubuntu/ansim-infra}
cd "$root"
exec 9> .deploy.lock
flock -w 600 9
archive="$root/incoming/$release/release.tar.gz"
stage="$root/releases/$release"
backup="$root/backups/$release"
[[ ! -e "$stage" && ! -e "$backup" ]]
for file in compose.yaml compose.api.yaml compose.web.yaml shared/api.env; do test -s "$file"; done
python3 - "$archive" <<'CHECK'
import sys, tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1]) as archive:
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or any(part.startswith('.env') for part in path.parts):
            raise SystemExit('Unsafe release path')
        if not (member.isfile() or member.isdir()):
            raise SystemExit('Unsupported release entry')
        if not (str(path) in ('app', 'app/server', 'app/web', 'compose.web.yaml') or str(path).startswith(('app/server/', 'app/web/'))):
            raise SystemExit('Unexpected release entry')
CHECK
mkdir -p "$stage" "$backup"
chmod 700 "$backup"
tar -xzf "$archive" -C "$stage"
compose=(docker compose -f compose.yaml -f compose.api.yaml -f compose.web.yaml)
"${compose[@]}" config --quiet
db_before=$("${compose[@]}" ps -q db)
[[ -n "$db_before" ]]
for service in api web; do
  container=$("${compose[@]}" ps -q "$service")
  [[ -n "$container" ]]
  image=$(docker inspect --format '{{.Image}}' "$container")
  docker image tag "$image" "ansim-note-$service:rollback-$release"
done
printf 'services:\n  api:\n    image: ansim-note-api:rollback-%s\n  web:\n    image: ansim-note-web:rollback-%s\n' "$release" "$release" > "$backup/rollback.yaml"
cp compose.web.yaml "$backup/compose.web.yaml"
cp -a app/server "$backup/server"
cp -a app/web "$backup/web"
rollback() {
  code=$?
  trap - ERR INT TERM
  set +e
  echo 'Deployment failed; restoring previous API and web.'
  rm -rf app/server app/web
  cp -a "$backup/server" app/server
  cp -a "$backup/web" app/web
  cp "$backup/compose.web.yaml" compose.web.yaml
  "${compose[@]}" -f "$backup/rollback.yaml" up -d --no-deps --no-build --wait --wait-timeout 120 api web
  restored=$?
  if [[ "$restored" == 0 ]]; then echo 'Previous containers restored.'; else echo 'Rollback needs manual attention.'; fi
  [[ "$code" != 0 ]] || code=1
  exit "$code"
}
trap rollback ERR INT TERM
rm -rf app/server app/web
cp -a "$stage/app/server" app/server
cp -a "$stage/app/web" app/web
cp "$stage/compose.web.yaml" compose.web.yaml
"${compose[@]}" config --quiet
"${compose[@]}" build api web
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api web
for path in / /api/health /api/health/db /api/auth/me; do
  curl --fail --silent --show-error --max-time 15 --retry 5 --retry-delay 2 --retry-all-errors "http://127.0.0.1$path" > /dev/null
done
curl --fail --silent --show-error --max-time 15 http://127.0.0.1/deployment-version.json | python3 -c 'import json,sys; assert json.load(sys.stdin)["release"] == sys.argv[1]' "$release"
[[ "$db_before" == "$("${compose[@]}" ps -q db)" ]]
printf '{"release":"%s"}\n' "$release" > current-release.json
trap - ERR INT TERM
echo "Deployment healthy: $release"
