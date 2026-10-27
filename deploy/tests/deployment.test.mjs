import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const script = resolve('deploy/ec2-deploy.sh')
for (const failure of ['none', 'build', 'start', 'health']) {
  const fail = failure !== 'none'
  test(fail ? `${failure} 실패 시 코드와 이미지 복구, DB 설정 유지` : '성공 시 새 코드 반영, DB 설정 유지', () => {
    const root = mkdtempSync(join(tmpdir(), 'ansim-deploy-'))
    try {
      const put = (path, value, executable = false) => {
        mkdirSync(join(root, path, '..'), { recursive: true })
        writeFileSync(join(root, path), value, { mode: executable ? 0o755 : 0o600 })
      }
      for (const file of ['compose.yaml', 'compose.api.yaml', 'compose.web.yaml', 'shared/api.env']) put(file, 'original')
      for (const service of ['server', 'web']) put(`app/${service}/version`, 'old')
      put('payload/app/server/version', 'new')
      put('payload/app/web/version', 'new')
      put('payload/compose.web.yaml', 'new-compose')
      mkdirSync(join(root, 'incoming/test'), { recursive: true })
      assert.equal(spawnSync('tar', ['-czf', join(root, 'incoming/test/release.tar.gz'), '-C', join(root, 'payload'), 'app', 'compose.web.yaml'], { env: { ...process.env, COPYFILE_DISABLE: '1' } }).status, 0)
      put('bin/flock', '#!/bin/sh\nexit 0\n', true)
      put('bin/docker', `#!/bin/sh
printf '%s\\n' "$*" >> "$ANSIM_DEPLOY_ROOT/docker.log"
case "$*" in
  *"ps -q db"*) echo db-unchanged;;
  *"ps -q api"*) echo api-old;;
  *"ps -q web"*) echo web-old;;
  inspect*) echo sha256:old;;
  *"rollback.yaml"*) exit 0;;
  *"build api web"*) ${failure === 'build' ? 'exit 1' : 'exit 0'};;
  *"up -d"*) ${failure === 'start' ? 'exit 1' : 'exit 0'};;
esac
`, true)
      put('bin/curl', `#!/bin/sh\n${failure === 'health' ? 'exit 1' : `printf '%s' '{"release":"test"}'`}\n`, true)
      const result = spawnSync('bash', [script, 'test'], { env: { ...process.env, ANSIM_DEPLOY_ROOT: root, PATH: `${join(root, 'bin')}:${process.env.PATH}` }, encoding: 'utf8' })
      assert.equal(result.status, fail ? 1 : 0, result.stdout + result.stderr)
      assert.equal(readFileSync(join(root, 'app/server/version'), 'utf8'), fail ? 'old' : 'new')
      assert.equal(readFileSync(join(root, 'app/web/version'), 'utf8'), fail ? 'old' : 'new')
      assert.equal(readFileSync(join(root, 'shared/api.env'), 'utf8'), 'original')
      assert.equal(existsSync(join(root, 'current-release.json')), !fail)
      const commands = readFileSync(join(root, 'docker.log'), 'utf8')
      assert.doesNotMatch(commands, /down|up.* db/)
      if (fail) assert.match(commands, /rollback.yaml.*--no-build/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}
test('경로를 벗어나는 릴리스 ID 차단', () => {
  assert.equal(spawnSync('bash', [script, '../unsafe']).status, 2)
})

test('배포 묶음에 환경변수 제외, 릴리스 식별자 포함', () => {
  const root = mkdtempSync(join(tmpdir(), 'ansim-package-'))
  try {
    for (const file of ['server/Dockerfile', 'server/.dockerignore', 'server/package.json', 'server/package-lock.json', 'server/src/index.js', 'deploy/web/Dockerfile', 'deploy/web/nginx.conf', 'deploy/compose.web.yaml', 'dist/index.html', '.env', 'server/.env']) {
      mkdirSync(join(root, file, '..'), { recursive: true })
      writeFileSync(join(root, file), 'fixture')
    }
    const archive = join(root, 'release.tar.gz')
    const result = spawnSync('bash', [resolve('deploy/package-release.sh'), 'test-release', archive], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const list = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' }).stdout
    assert.doesNotMatch(list, /(?:^|\/)\.env/m)
    assert.match(list, /app\/server\/src\/index.js/)
    const version = spawnSync('tar', ['-xOzf', archive, 'app/web/dist/deployment-version.json'], { encoding: 'utf8' }).stdout
    assert.equal(JSON.parse(version).release, 'test-release')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
