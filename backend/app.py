from fastapi import FastAPI, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, Float, create_engine, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime, date
from typing import List, Optional
import os
from dotenv import load_dotenv
import pytz
import time
import pandas as pd
from io import BytesIO
import json

# 載入環境變數
load_dotenv()

# 設置台北時區
TAIPEI_TZ = pytz.timezone('Asia/Taipei')

def get_taipei_time():
    """取得台北當前時間"""
    return datetime.now(TAIPEI_TZ)

# 並發控制：防止重複掃描
recent_scans = {}  # 記住最近的掃描時間

def cleanup_recent_scans():
    """清理過期的掃描記錄"""
    current_time = time.time()
    expired_keys = [k for k, v in recent_scans.items() if current_time - v > 2]
    for key in expired_keys:
        recent_scans.pop(key, None)

app = FastAPI(title="Barcode Scanner API", description="條碼掃描系統 API", version="1.0.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 日誌記錄中間件
@app.middleware("http")
async def log_api_calls(request: Request, call_next):
    start_time = time.time()
    
    # 獲取請求資訊
    method = request.method
    endpoint = str(request.url.path)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # 獲取請求資料
    request_data = {}
    if method in ["POST", "PUT", "PATCH"]:
        try:
            # 讀取 body 並重新設置，避免消耗掉請求資料
            body = await request.body()
            if body:
                request_data = json.loads(body.decode())
                # 重新設置 request 的 body，讓後續處理可以讀取
                async def receive():
                    return {"type": "http.request", "body": body}
                request._receive = receive
        except:
            request_data = {"raw_body": "無法解析"}
    
    # 執行請求
    response = await call_next(request)
    
    # 計算執行時間
    execution_time = round(time.time() - start_time, 3)  # 轉換為毫秒
    
    # 獲取回應資料
    response_data = {}
    if hasattr(response, 'body'):
        try:
            response_body = response.body
            if response_body:
                response_data = json.loads(response_body.decode())
        except:
            response_data = {"raw_body": "無法解析"}
    
    # 記錄到資料庫
    try:
        db = SessionLocal()
        api_log = ApiLog(
            method=method,
            endpoint=endpoint,
            request_data=json.dumps(request_data, ensure_ascii=False) if request_data else None,
            response_status=response.status_code,
            response_data=json.dumps(response_data, ensure_ascii=False) if response_data else None,
            client_ip=client_ip,
            user_agent=user_agent,
            execution_time=execution_time
        )
        db.add(api_log)
        db.commit()
        db.close()
    except Exception as e:
        print(f"API 日誌記錄失敗: {e}")
    
    return response

# 資料庫配置
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 資料庫模型
class BarcodesMaster(Base):
    __tablename__ = "barcodes_master"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), nullable=False, unique=True, index=True)  # 唯一約束
    total_scan_count = Column(Integer, default=0)  # 總掃描次數
    last_scan_time = Column(DateTime)  # 最後掃描時間
    first_upload_time = Column(DateTime)  # 第一次上傳時間
    last_upload_time = Column(DateTime)  # 最後上傳時間
    total_upload_count = Column(Integer, default=0)  # 總上傳次數
    created_at = Column(DateTime, default=get_taipei_time)
    updated_at = Column(DateTime, default=get_taipei_time, onupdate=get_taipei_time)

class UploadRecord(Base):
    __tablename__ = "upload_records"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), nullable=False, index=True)  # 允許重複
    upload_time = Column(DateTime, nullable=False, default=get_taipei_time)
    upload_batch_id = Column(String(50))  # 批次ID
    created_at = Column(DateTime, default=get_taipei_time)

class ScanHistory(Base):
    __tablename__ = "scan_history"
    
    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(100), nullable=False)
    result = Column(String(20), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=get_taipei_time)

# API 日誌表
class ApiLog(Base):
    __tablename__ = "api_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    method = Column(String(10), nullable=False)  # GET, POST, PUT, DELETE
    endpoint = Column(String(255), nullable=False)  # API 端點
    request_data = Column(String(1000))  # 請求資料 (JSON 字串)
    response_status = Column(Integer, nullable=False)  # HTTP 狀態碼
    response_data = Column(String(1000))  # 回應資料 (JSON 字串)
    client_ip = Column(String(45))  # 客戶端 IP
    user_agent = Column(String(500))  # 用戶代理
    execution_time = Column(Float)  # 執行時間 (毫秒)
    timestamp = Column(DateTime, nullable=False, default=get_taipei_time)

# Pydantic 模型
class BarcodeCreate(BaseModel):
    code: str

class BarcodeResponse(BaseModel):
    id: int
    code: str
    upload_time: Optional[datetime]  # 這裡對應 last_upload_time
    scan_count: int  # 這裡對應 total_scan_count
    last_scan_time: Optional[datetime]
    total_upload_count: Optional[int] = 0  # 新增總上傳次數
    first_upload_time: Optional[datetime] = None  # 新增第一次上傳時間
    
    class Config:
        from_attributes = True

class UploadRecordResponse(BaseModel):
    id: int
    code: str
    upload_time: datetime
    upload_batch_id: Optional[str] = None
    
    class Config:
        from_attributes = True

class BarcodesBulkCreate(BaseModel):
    codes: List[str]

class ScanRequest(BaseModel):
    code: str

class BarcodeSearchRequest(BaseModel):
    codes: List[str]

class DateRangeRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ScanResponse(BaseModel):
    result: str
    message: str
    barcode: str
    scan_count: Optional[int] = None

class ScanHistoryResponse(BaseModel):
    id: int
    barcode: str
    result: str
    timestamp: datetime
    
    class Config:
        from_attributes = True

class StatsResponse(BaseModel):
    total_barcodes: int
    successful_scans: int
    failed_scans: int

class MessageResponse(BaseModel):
    message: str

class DownloadExcelRequest(BaseModel):
    class Config:
        from_attributes = True
    data: List[BarcodeResponse]

class OfflineScanRecord(BaseModel):
    barcode: str
    result: str
    message: str
    timestamp: str

class OfflineSyncRequest(BaseModel):
    records: List[OfflineScanRecord]

# 資料庫依賴注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/health")
def health_check():
    """健康檢查"""
    return {"status": "ok"}

@app.get("/api/logs", response_model=List[dict])
def get_api_logs(limit: int = 100, db: Session = Depends(get_db)):
    """獲取 API 日誌"""
    logs = db.query(ApiLog).order_by(ApiLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "method": log.method,
            "endpoint": log.endpoint,
            "request_data": json.loads(log.request_data) if log.request_data else None,
            "response_status": log.response_status,
            "response_data": json.loads(log.response_data) if log.response_data else None,
            "client_ip": log.client_ip,
            "execution_time": log.execution_time,
            "timestamp": log.timestamp
        }
        for log in logs
    ]
    

# API 路由
@app.get("/api/barcodes", response_model=List[BarcodeResponse])
def get_barcodes(db: Session = Depends(get_db)):
    """獲取所有條碼（每個條碼只有一條主記錄）"""
    
    # 直接從條碼主表獲取所有記錄
    barcodes_master = db.query(BarcodesMaster).order_by(BarcodesMaster.last_upload_time.desc()).limit(500).all()
    
    # 轉換為 BarcodeResponse 格式
    result = []
    for bm in barcodes_master:
        result.append(BarcodeResponse(
            id=bm.id,
            code=bm.code,
            upload_time=bm.last_upload_time,  # 顯示最後上傳時間
            scan_count=bm.total_scan_count,
            last_scan_time=bm.last_scan_time,
            total_upload_count=bm.total_upload_count,
            first_upload_time=bm.first_upload_time
        ))
    
    return result

@app.post("/api/barcodes/search", response_model=List[BarcodeResponse])
def search_barcodes(search_request: BarcodeSearchRequest, db: Session = Depends(get_db)):
    """多筆條碼查詢"""
    if not search_request.codes:
        return []
    
    # 移除空白和重複的條碼
    codes = list(set([code.strip() for code in search_request.codes if code.strip()]))
    
    barcodes_master = db.query(BarcodesMaster).filter(BarcodesMaster.code.in_(codes)).all()
    
    # 轉換為 BarcodeResponse 格式
    result = []
    for bm in barcodes_master:
        result.append(BarcodeResponse(
            id=bm.id,
            code=bm.code,
            upload_time=bm.last_upload_time,
            scan_count=bm.total_scan_count,
            last_scan_time=bm.last_scan_time,
            total_upload_count=bm.total_upload_count,
            first_upload_time=bm.first_upload_time
        ))
    
    return result

@app.post("/api/barcodes/date-range", response_model=List[BarcodeResponse])
def get_barcodes_by_date_range(date_request: DateRangeRequest, db: Session = Depends(get_db)):
    """依日期範圍查詢條碼（從主表查詢）"""
    query = db.query(BarcodesMaster)
    
    if date_request.start_date:
        # 將日期轉換為該日的開始時間
        start_datetime = datetime.combine(date_request.start_date, datetime.min.time())
        start_datetime = TAIPEI_TZ.localize(start_datetime)
        query = query.filter(BarcodesMaster.last_upload_time >= start_datetime)
    
    if date_request.end_date:
        # 將日期轉換為該日的結束時間
        end_datetime = datetime.combine(date_request.end_date, datetime.max.time())
        end_datetime = TAIPEI_TZ.localize(end_datetime)
        query = query.filter(BarcodesMaster.last_upload_time <= end_datetime)
    
    barcodes_master = query.order_by(BarcodesMaster.last_upload_time.desc()).all()
    
    # 轉換為 BarcodeResponse 格式
    result = []
    for bm in barcodes_master:
        result.append(BarcodeResponse(
            id=bm.id,
            code=bm.code,
            upload_time=bm.last_upload_time,
            scan_count=bm.total_scan_count,
            last_scan_time=bm.last_scan_time,
            total_upload_count=bm.total_upload_count,
            first_upload_time=bm.first_upload_time
        ))
    
    return result

@app.post("/api/barcodes/bulk")
def upload_barcodes(barcodes_data: BarcodesBulkCreate, db: Session = Depends(get_db)):
    """批量上傳條碼 - 新的邏輯支援重複條碼上傳"""
    if not barcodes_data.codes:
        raise HTTPException(status_code=400, detail="沒有提供條碼")
    
    new_barcodes = []  # 全新的條碼
    existing_barcodes = []  # 已存在的條碼
    current_time = get_taipei_time()
    
    # 生成批次ID
    import uuid
    batch_id = str(uuid.uuid4())[:8]
    
    for code in barcodes_data.codes:
        if not code.strip():
            continue
            
        code = code.strip()
        
        # 檢查條碼是否已存在於主表
        existing_master = db.query(BarcodesMaster).filter(BarcodesMaster.code == code).first()
        
        if existing_master:
            existing_barcodes.append(code)
        else:
            new_barcodes.append(code)
        
        # 無論是否重複，都要記錄上傳記錄
        upload_record = UploadRecord(
            code=code,
            upload_time=current_time,
            upload_batch_id=batch_id
        )
        db.add(upload_record)
    
    # 提交所有上傳記錄（觸發器會自動更新主表）
    db.commit()
    
    # 構建回傳訊息
    total_count = len([c for c in barcodes_data.codes if c.strip()])
    new_count = len(new_barcodes)
    existing_count = len(existing_barcodes)
    
    message = f"上傳完成！總共 {total_count} 個條碼，全新 {new_count} 個，已存在 {existing_count} 個"
    
    return {
        "message": message,
        "total": total_count,
        "new_count": new_count,
        "existing_count": existing_count,
        "new_barcodes": new_barcodes,
        "existing_barcodes": existing_barcodes,
        "batch_id": batch_id
    }

@app.delete("/api/barcodes/clear", response_model=MessageResponse)
def clear_all_barcodes(db: Session = Depends(get_db)):
    """清空所有條碼資料"""
    # 清空所有表的資料
    db.query(UploadRecord).delete()
    db.query(BarcodesMaster).delete()
    db.query(ScanHistory).delete()
    db.commit()
    
    return MessageResponse(message="所有資料已清空")

@app.post("/api/scan", response_model=ScanResponse)
def scan_barcode(scan_data: ScanRequest, db: Session = Depends(get_db)):
    """掃描條碼驗證 - 新的邏輯解決重複條碼掃描計數問題"""
    code = scan_data.code.strip()
    current_timestamp = time.time()
    
    # 清理過期記錄
    cleanup_recent_scans()
    
    # 快速重複檢查
    if code in recent_scans:
        time_diff = current_timestamp - recent_scans[code]
        if time_diff < 0.5:  # 500ms 內的重複掃描直接拒絕
            return ScanResponse(
                result="duplicate",
                message="掃描太快！請稍候再試",
                barcode=code
            )
    
    # 記錄掃描時間
    recent_scans[code] = current_timestamp
    
    try:
        # 查詢條碼主表檢查條碼是否存在
        barcode_master = db.query(BarcodesMaster).filter(BarcodesMaster.code == code).first()
        
        if barcode_master:
            # 條碼存在，確認收單
            current_time = get_taipei_time()
            
            # 原子操作：更新掃描次數和時間（整個系統只有一條記錄）
            barcode_master.total_scan_count += 1
            barcode_master.last_scan_time = current_time
            barcode_master.updated_at = current_time
            
            # 記錄掃描歷史
            scan = ScanHistory(barcode=code, result='success', timestamp=current_time)
            db.add(scan)
            db.commit()
            
            # 返回成功結果
            return ScanResponse(
                result="success",
                message="✅ 收單確認",
                barcode=code,
                scan_count=barcode_master.total_scan_count
            )
            
        else:
            # 條碼不存在，記錄失敗的掃描
            current_time = get_taipei_time()
            scan = ScanHistory(barcode=code, result='error', timestamp=current_time)
            db.add(scan)
            db.commit()
            
            return ScanResponse(
                result="error",
                message="❌ 非收單項目",
                barcode=code
            )
            
    except Exception as e:
        # 發生錯誤時清理記錄
        recent_scans.pop(code, None)
        raise e

@app.get("/api/scan-history", response_model=List[ScanHistoryResponse])
def get_scan_history(db: Session = Depends(get_db)):
    """獲取今日掃描歷史"""
    today = datetime.now().date()
    # 使用 func.date() 來提取日期部分進行比較
    history = db.query(ScanHistory).filter(func.date(ScanHistory.timestamp) == today).order_by(ScanHistory.timestamp.desc()).all()
    return history

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """獲取統計資料"""
    # 總條碼數（從主表獲取）
    total_barcodes = db.query(BarcodesMaster).count()
    
    # 計算不重複的成功掃描條碼數量
    successful_scans = db.query(ScanHistory.barcode).filter(
        ScanHistory.result == 'success'
    ).distinct().count()
    
    # 失敗掃描次數
    failed_scans = db.query(ScanHistory).filter(ScanHistory.result == 'error').count()
    
    return StatsResponse(
        total_barcodes=total_barcodes,
        successful_scans=successful_scans,
        failed_scans=failed_scans
    )

@app.post("/api/barcodes/download")
def download_excel(data: DownloadExcelRequest, db: Session = Depends(get_db)):
    """下載包含詳細資料的excel檔案"""
    try:
        download_data = data.data
        
        # 檢查是否有資料
        if not download_data:
            raise HTTPException(status_code=400, detail="沒有資料可下載")
        
        # 準備主要條碼資料
        main_dict_list = [item.model_dump() for item in download_data]
        main_df = pd.DataFrame(main_dict_list)
        
        # 重新命名欄位為中文
        main_df = main_df.rename(columns={
            'code': '條碼',
            'upload_time': '最新上傳時間',
            'last_scan_time': '最後掃描時間',
            'first_upload_time': '第一次上傳時間',
            'total_upload_count': '總上傳次數',
            'scan_count': '掃描次數',
        })
        
        # 處理datetime欄位，確保它們可以正確序列化
        for col in ['最新上傳時間', '最後掃描時間']:
            if col in main_df.columns:
                main_df[col] = main_df[col].astype(str)
        
        # 準備詳細資料工作表
        upload_records_data = []
        scan_history_data = []
        
        # 獲取每個條碼的詳細資料
        for barcode_item in download_data:
            code = barcode_item.code
            
            # 獲取所有上傳記錄
            upload_records = db.query(UploadRecord).filter(
                UploadRecord.code == code
            ).order_by(UploadRecord.upload_time.desc()).all()
            
            for record in upload_records:
                upload_records_data.append({
                    '條碼': code,
                    '上傳時間': record.upload_time,
                    '批次ID': record.upload_batch_id
                })
            
            # 獲取掃描歷史
            scan_history = db.query(ScanHistory).filter(
                ScanHistory.barcode == code
            ).order_by(ScanHistory.timestamp.desc()).all()
            
            for scan in scan_history:
                scan_history_data.append({
                    '條碼': code,
                    '掃描結果': '收單確認' if scan.result == 'success' else '非收單項目',
                    '掃描時間': scan.timestamp
                })
        
        # 創建DataFrame
        upload_records_df = pd.DataFrame(upload_records_data)
        scan_history_df = pd.DataFrame(scan_history_data)
        
        # 處理datetime欄位
        if not upload_records_df.empty:
            for col in ['最新上傳時間', '最後掃描時間']:
                if col in upload_records_df.columns:
                    upload_records_df[col] = upload_records_df[col].astype(str)
        
        if not scan_history_df.empty:
            if '掃描時間' in scan_history_df.columns:
                scan_history_df['掃描時間'] = scan_history_df['掃描時間'].astype(str)
        
        # 使用ExcelWriter創建多個工作表
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # 主要條碼資料工作表
            main_df.to_excel(writer, sheet_name='條碼資料', index=False)
            
            # 上傳記錄詳細資料工作表
            if not upload_records_df.empty:
                upload_records_df.to_excel(writer, sheet_name='上傳記錄詳細', index=False)
            
            # 掃描歷史詳細資料工作表
            if not scan_history_df.empty:
                scan_history_df.to_excel(writer, sheet_name='掃描歷史詳細', index=False)
            
            # 調整欄位寬度以便閱讀
            for sheet_name in writer.sheets:
                worksheet = writer.sheets[sheet_name]
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)  # 限制最大寬度
                    worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        # 根據資料筆數生成檔案名稱
        filename = f"barcodes_data_{len(download_data)}.xlsx"
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下載Excel失敗: {str(e)}")

@app.post("/api/offline-sync", response_model=MessageResponse)
def sync_offline_records(sync_request: OfflineSyncRequest, db: Session = Depends(get_db)):
    """同步離線掃描記錄"""
    if not sync_request.records:
        return MessageResponse(message="沒有需要同步的記錄")
    
    synced_count = 0
    error_count = 0
    
    try:
        for record in sync_request.records:
            try:
                # 解析時間戳
                from datetime import datetime
                import pytz
                
                # 嘗試解析 ISO 格式時間戳
                if record.timestamp.endswith('Z'):
                    # UTC 時間
                    timestamp = datetime.fromisoformat(record.timestamp.replace('Z', '+00:00'))
                    # 轉換為台北時間
                    taipei_tz = pytz.timezone('Asia/Taipei')
                    timestamp = timestamp.astimezone(taipei_tz)
                else:
                    # 假設是台北時間
                    timestamp = datetime.fromisoformat(record.timestamp)
                    if timestamp.tzinfo is None:
                        taipei_tz = pytz.timezone('Asia/Taipei')
                        timestamp = taipei_tz.localize(timestamp)
                
                # 創建掃描歷史記錄
                scan_history = ScanHistory(
                    barcode=record.barcode,
                    result=record.result,
                    timestamp=timestamp
                )
                db.add(scan_history)
                
                # 如果是成功掃描，更新條碼主表的掃描次數
                if record.result == 'success':
                    barcode_master = db.query(BarcodesMaster).filter(BarcodesMaster.code == record.barcode).first()
                    if barcode_master:
                        barcode_master.total_scan_count += 1
                        barcode_master.last_scan_time = timestamp
                        barcode_master.updated_at = timestamp
                
                synced_count += 1
                
            except Exception as e:
                error_count += 1
                continue
        
        # 提交所有變更
        db.commit()
        
        return MessageResponse(
            message=f"同步完成：成功 {synced_count} 條，失敗 {error_count} 條"
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"同步失敗: {str(e)}")


@app.get("/api/barcodes/details/{code}")
def get_barcode_details(code: str, db: Session = Depends(get_db)):
    """獲取指定條碼的所有上傳記錄和掃描歷史"""
    try:
        # 獲取條碼主表記錄
        barcode_master = db.query(BarcodesMaster).filter(BarcodesMaster.code == code).first()
        
        if not barcode_master:
            raise HTTPException(status_code=404, detail="條碼不存在")
        
        # 獲取所有上傳記錄（按上傳時間排序）
        upload_records = db.query(UploadRecord).filter(
            UploadRecord.code == code
        ).order_by(UploadRecord.upload_time.desc()).all()
        
        # 獲取掃描歷史（按掃描時間排序）
        scan_history = db.query(ScanHistory).filter(
            ScanHistory.barcode == code
        ).order_by(ScanHistory.timestamp.desc()).all()
        
        return {
            "code": code,
            "master_record": {
                "id": barcode_master.id,
                "total_scan_count": barcode_master.total_scan_count,
                "last_scan_time": barcode_master.last_scan_time,
                "first_upload_time": barcode_master.first_upload_time,
                "last_upload_time": barcode_master.last_upload_time,
                "total_upload_count": barcode_master.total_upload_count,
                "created_at": barcode_master.created_at,
                "updated_at": barcode_master.updated_at
            },
            "upload_records": [
                {
                    "id": record.id,
                    "upload_time": record.upload_time,
                    "upload_batch_id": record.upload_batch_id,
                } for record in upload_records
            ],
            "scan_history": [
                {
                    "id": scan.id,
                    "result": scan.result,
                    "timestamp": scan.timestamp
                } for scan in scan_history
            ],
            "total_uploads": len(upload_records),
            "total_scans": len(scan_history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"獲取詳細資料失敗: {str(e)}")


# 創建資料庫表格
def create_tables():
    Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def startup_event():
    create_tables()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)