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
  // 안심노트 위도·경도(DECIMAL)를 숫자로, 날짜는 UTC 기준으로 읽는다
  decimalNumbers: true,
  timezone: 'Z',
})

// DATETIME 생성과 mysql2의 UTC 해석 기준을 맞춘다. 새 연결마다 적용한다.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) connection.destroy()
  })
})

export default pool
