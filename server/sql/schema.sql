-- MySQL 8 기준. 대상 DB를 선택한 뒤 최초 한 번 적용한다.
-- 회원 담당자가 users를 먼저 만들었다면 users 정의는 함께 맞추고 notes만 적용한다.
-- FK로 연결하는 users.id와 notes.author_id의 타입/UNSIGNED는 반드시 같아야 한다.
-- DB 생성·기존 테이블 삭제·기존 회원 변경은 수행하지 않는다.
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author_id INT UNSIGNED NOT NULL,
  title VARCHAR(60) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  tag VARCHAR(20) NOT NULL,
  observed_date DATE NOT NULL,
  location_name VARCHAR(255) NOT NULL DEFAULT '',
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN') NOT NULL DEFAULT 'PENDING',
  moderation_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notes_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_notes_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_notes_longitude CHECK (longitude BETWEEN -180 AND 180),
  INDEX idx_notes_status_created (status, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
