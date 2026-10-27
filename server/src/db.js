import process from 'node:process'
import mysql from 'mysql2/promise'

const requiredSettings = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
]

for (const name of requiredSettings) {
  if (!process.env[name]) {
    throw new Error(`필수 환경 변수가 없습니다: ${name}`)
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 20,
  connectTimeout: 10000,
  supportBigNumbers: true,
  bigNumberStrings: true,
})

export default pool
