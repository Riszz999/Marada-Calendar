CREATE DATABASE IF NOT EXISTS reservation_calendar
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE reservation_calendar;

CREATE TABLE IF NOT EXISTS reservations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reserved_date DATE         NOT NULL,
  reserved_time TIME         NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  seats         INT UNSIGNED NOT NULL,
  phone         VARCHAR(32)  NOT NULL,
  zone          VARCHAR(120) NULL,
  food_order    TEXT         NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  source        VARCHAR(16) NOT NULL DEFAULT 'admin',
  admin_note    VARCHAR(2000) NOT NULL DEFAULT '',
  requested_at  DATETIME NULL,
  reviewed_at   DATETIME NULL,
  revision      INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reserved_date (reserved_date),
  INDEX idx_requests_status_date (source,status,reserved_date),
  CONSTRAINT chk_seats_min CHECK (seats >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- บัญชีแอดมิน — แถวแรกถูกสร้างอัตโนมัติจาก .env โดย server/src/bootstrap.js
-- collation utf8mb4_unicode_ci เป็น case-insensitive อยู่แล้ว 'Admin' จึงชนกับ 'admin'
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- access key สำหรับพนักงาน — มีได้แถวเดียวเท่านั้น (id = 1)
-- ไม่มีแถว = ปิดโหมดพนักงาน ทุกคนที่ไม่ใช่แอดมินจะเห็นแค่วัน/เวลาที่ถูกจอง
-- key_version ทำหน้าที่เดียวกับ token_version ของ admin_users: เปลี่ยน key แล้ว token เก่าตายหมด
CREATE TABLE IF NOT EXISTS staff_key (
  id          TINYINT UNSIGNED PRIMARY KEY,
  key_hash    VARCHAR(255) NOT NULL,
  key_ciphertext TEXT NULL,
  key_version INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_staff_key_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

