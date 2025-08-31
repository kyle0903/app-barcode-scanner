-- 設置資料庫編碼和時區
ALTER DATABASE barcode_scanner_db SET timezone TO 'Asia/Taipei';
ALTER DATABASE barcode_scanner_db SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS barcodes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scan_count INTEGER DEFAULT 0,
    last_scan_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_history (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(100) NOT NULL,
    result VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
