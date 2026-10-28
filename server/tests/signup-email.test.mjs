import assert from 'node:assert/strict'
import process from 'node:process'
import { once } from 'node:events'
import test from 'node:test'
import {
  validateSignup as validateClient,
  validateLogin as validateClientLogin,
} from '../../src/api/authApi.js'
import {
  validateSignup as validateServer,
  validateLogin as validateServerLogin,
} from '../src/validation/auth.js'
import { createApp } from '../src/app.js'

const input = {
  nickname: '검증회원',
  password: 'test-password-123',
  passwordConfirm: 'test-password-123',
  agreed: true,
}
const invalid = [
  '한글@example.com',
  'abc@한글.com',
  'abc@example.한국',
  '한@example.com',
  'Ａbc@example.com',
  'abc＠example.com',
  'abc@example．com',
  'abc😀@example.com',
  'abc\u200b@example.com',
  'abc\u0000@example.com',
  'abc def@example.com',
  'abc@@example.com',
  'abc@example',
  'a'.repeat(243) + '@example.com',
]

test('신규 가입은 한글·유니코드·잘못된 형식을 프론트와 서버에서 동일하게 거절한다', () => {
  for (const email of invalid) {
    const client = validateClient({ ...input, email })
    const server = validateServer({ ...input, email })
    assert.ok(client.length > 0, email)
    assert.deepEqual(client, server, email)
  }
  for (const email of [
    'abcd1234@test.com',
    'First.Last+tag@example.co.kr',
    'user_name-123@example.com',
    ' USER@Test.com ',
  ]) {
    assert.deepEqual(validateClient({ ...input, email }), [])
    assert.deepEqual(validateServer({ ...input, email }), [])
  }
  // 기존에 등록된 이메일의 로그인 검증 정책을 이번 가입 제한으로 바꾸지 않는다.
  assert.deepEqual(
    validateClientLogin({ ...input, email: '한글@example.com' }),
    [],
  )
  assert.deepEqual(
    validateServerLogin({ ...input, email: '한글@example.com' }),
    [],
  )
})

test('화면을 우회해 가입 API로 한글을 보내도 DB 조회·저장 전에 400을 반환한다', async (t) => {
  // 테스트 프로세스 전용 설정. 실제 DB/비밀값 없이 라우터를 초기화한다.
  const settings = {
    DB_HOST: 'unused.invalid',
    DB_PORT: '3306',
    DB_NAME: 'test',
    DB_USER: 'test',
    DB_PASSWORD: 'test-only',
    JWT_SECRET: 'signup-validation-test-only-secret-32chars',
  }
  const previous = Object.fromEntries(
    Object.keys(settings).map((key) => [key, process.env[key]]),
  )
  Object.assign(process.env, settings)
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const { default: authRouter } = await import('../src/routes/auth.js')
  const { default: pool } = await import('../src/db.js')
  let calls = 0
  const execute = pool.execute
  pool.execute = async () => {
    calls++
    throw new Error('must not query DB')
  }
  t.after(async () => {
    pool.execute = execute
    await pool.end()
  })
  const server = createApp({ authRouter }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  for (const email of [
    '한글@example.com',
    'abc@한글.com',
    'Ａbc@example.com',
  ]) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/signup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, email }),
      },
    )
    assert.equal(response.status, 400)
    assert.match((await response.json()).message, /이메일/)
    assert.equal(response.headers.get('set-cookie'), null)
  }
  assert.equal(calls, 0)
})
