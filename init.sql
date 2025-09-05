-- 設置資料庫編碼和時區
ALTER DATABASE barcode_scanner_db SET timezone TO 'Asia/Taipei';
ALTER DATABASE barcode_scanner_db SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS api_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_data VARCHAR(1000),
    response_status INTEGER NOT NULL,
    response_data VARCHAR(1000),
    client_ip VARCHAR(45),
    execution_time FLOAT,
    user_agent VARCHAR(500),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. 創建新的條碼主表（每個條碼只有一條記錄）
CREATE TABLE IF NOT EXISTS barcodes_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,  -- 唯一約束，確保每個條碼只有一條記錄
    total_scan_count INTEGER DEFAULT 0,  -- 該條碼的總掃描次數
    last_scan_time TIMESTAMP,            -- 最後一次掃描時間
    first_upload_time TIMESTAMP,         -- 第一次上傳時間
    last_upload_time TIMESTAMP,          -- 最後一次上傳時間
    total_upload_count INTEGER DEFAULT 0, -- 總上傳次數
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 創建上傳記錄表（記錄每次上傳）
CREATE TABLE IF NOT EXISTS upload_records (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL,          -- 條碼（允許重複）
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 上傳時間
    upload_batch_id VARCHAR(50),         -- 批次ID（可選，用於區分不同批次的上傳）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 為新表建立索引以提升查詢效能
CREATE INDEX idx_barcodes_master_code ON barcodes_master(code);
CREATE INDEX idx_upload_records_code ON upload_records(code);
CREATE INDEX idx_upload_records_upload_time ON upload_records(upload_time);

-- 4. 創建觸發器函數：自動更新條碼主表的統計資料
CREATE OR REPLACE FUNCTION update_barcode_master_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 當新增上傳記錄時，更新或創建條碼主表記錄
    INSERT INTO barcodes_master (
        code, 
        total_upload_count, 
        first_upload_time, 
        last_upload_time,
        updated_at
    ) VALUES (
        NEW.code, 
        1, 
        NEW.upload_time, 
        NEW.upload_time,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (code) DO UPDATE SET
        total_upload_count = barcodes_master.total_upload_count + 1,
        last_upload_time = GREATEST(barcodes_master.last_upload_time, NEW.upload_time),
        first_upload_time = LEAST(barcodes_master.first_upload_time, NEW.upload_time),
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 創建觸發器
CREATE TRIGGER trigger_update_barcode_stats
    AFTER INSERT ON upload_records
    FOR EACH ROW
    EXECUTE FUNCTION update_barcode_master_stats();