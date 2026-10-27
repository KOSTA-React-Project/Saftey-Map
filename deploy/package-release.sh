#!/usr/bin/env bash
set -euo pipefail
release=${1:?release ID required}
output=${2:?output archive required}
[[ "$release" =~ ^[a-zA-Z0-9_-]{1,100}$ ]] || exit 2
[[ -s dist/index.html ]] || { echo 'Build dist first'; exit 1; }
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/app/server" "$stage/app/web"
cp server/Dockerfile server/.dockerignore server/package.json server/package-lock.json "$stage/app/server/"
cp -R server/src "$stage/app/server/"
cp deploy/web/Dockerfile deploy/web/nginx.conf "$stage/app/web/"
cp -R dist "$stage/app/web/"
printf '{"release":"%s"}\n' "$release" > "$stage/app/web/dist/deployment-version.json"
cp deploy/compose.web.yaml "$stage/"
COPYFILE_DISABLE=1 tar -czf "$output" -C "$stage" app compose.web.yaml
