import { Buffer } from 'node:buffer'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const COST = 16384
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 64

// 저장 형식: scrypt$N$r$p$솔트$해시 (솔트·해시는 base64). 회원마다 다른 임의 솔트 사용
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  })
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$')
}

// 저장 형식이 다르거나 깨져 있으면 일치하지 않는 것으로 본다.
export async function verifyPassword(password, stored) {
  const [algorithm, cost, blockSize, parallelism, salt, hash] =
    String(stored).split('$')
  if (algorithm !== 'scrypt' || !salt || !hash) return false

  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64'),
    expected.length,
    { N: Number(cost), r: Number(blockSize), p: Number(parallelism) },
  )
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
