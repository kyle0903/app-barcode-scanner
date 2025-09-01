from fastapi import FastAPI, HTTPException, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, create_engine
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

# 資料庫配置
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 資料庫模型
class Barcode(Base):
    __tablename__ = "barcodes"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    upload_time = Column(DateTime, nullable=False, default=get_taipei_time)
    scan_count = Column(Integer, default=0)
    last_scan_time = Column(DateTime)

class ScanHistory(Base):
    __tablename__ = "scan_history"
    
    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(100), nullable=False)
    result = Column(String(20), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=get_taipei_time)

# Pydantic 模型
class BarcodeCreate(BaseModel):
    code: str

class BarcodeResponse(BaseModel):
    id: int
    code: str
    upload_time: Optional[datetime]
    scan_count: int
    last_scan_time: Optional[datetime]
    
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

# 資料庫依賴注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API 路由
@app.get("/api/barcodes", response_model=List[BarcodeResponse])
def get_barcodes(db: Session = Depends(get_db)):
    """獲取所有條碼"""
    barcodes = db.query(Barcode).limit(500).all()
    return barcodes

@app.post("/api/barcodes/search", response_model=List[BarcodeResponse])
def search_barcodes(search_request: BarcodeSearchRequest, db: Session = Depends(get_db)):
    """多筆條碼查詢"""
    if not search_request.codes:
        return []
    
    # 移除空白和重複的條碼
    codes = list(set([code.strip() for code in search_request.codes if code.strip()]))
    
    barcodes = db.query(Barcode).filter(Barcode.code.in_(codes)).all()
    return barcodes

@app.post("/api/barcodes/date-range", response_model=List[BarcodeResponse])
def get_barcodes_by_date_range(date_request: DateRangeRequest, db: Session = Depends(get_db)):
    """依日期範圍查詢條碼"""
    query = db.query(Barcode)
    
    if date_request.start_date:
        # 將日期轉換為該日的開始時間
        start_datetime = datetime.combine(date_request.start_date, datetime.min.time())
        start_datetime = TAIPEI_TZ.localize(start_datetime)
        query = query.filter(Barcode.upload_time >= start_datetime)
    
    if date_request.end_date:
        # 將日期轉換為該日的結束時間
        end_datetime = datetime.combine(date_request.end_date, datetime.max.time())
        end_datetime = TAIPEI_TZ.localize(end_datetime)
        query = query.filter(Barcode.upload_time <= end_datetime)
    
    barcodes = query.order_by(Barcode.upload_time.desc()).all()
    return barcodes

@app.post("/api/barcodes", response_model=BarcodeResponse)
def add_barcode(barcode_data: BarcodeCreate, db: Session = Depends(get_db)):
    """新增條碼"""
    # 檢查條碼是否已存在
    existing = db.query(Barcode).filter(Barcode.code == barcode_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="條碼已存在")
    
    barcode = Barcode(code=barcode_data.code)
    db.add(barcode)
    db.commit()
    db.refresh(barcode)
    
    return barcode

@app.post("/api/barcodes/bulk", response_model=MessageResponse)
def upload_barcodes(barcodes_data: BarcodesBulkCreate, db: Session = Depends(get_db)):
    """批量上傳條碼"""
    if not barcodes_data.codes:
        raise HTTPException(status_code=400, detail="沒有提供條碼")
    
    added_count = 0
    duplicate_count = 0
    
    for code in barcodes_data.codes:
        if code and not db.query(Barcode).filter(Barcode.code == code).first():
            barcode = Barcode(code=code)
            db.add(barcode)
            added_count += 1
        else:
            duplicate_count += 1
    
    db.commit()
    
    return MessageResponse(message=f"成功新增 {added_count} 個條碼，重複 {duplicate_count} 個條碼")

@app.delete("/api/barcodes/id/{barcode_id}", response_model=MessageResponse)
def delete_barcode(barcode_id: int, db: Session = Depends(get_db)):
    """刪除條碼"""
    barcode = db.query(Barcode).filter(Barcode.id == barcode_id).first()
    if not barcode:
        raise HTTPException(status_code=404, detail="條碼不存在")
    
    db.delete(barcode)
    db.commit()
    
    return MessageResponse(message="條碼已刪除")

@app.delete("/api/barcodes/clear", response_model=MessageResponse)
def clear_all_barcodes(db: Session = Depends(get_db)):
    """清空所有條碼"""
    db.query(Barcode).delete()
    db.query(ScanHistory).delete()
    db.commit()
    
    return MessageResponse(message="所有資料已清空")

@app.post("/api/scan", response_model=ScanResponse)
def scan_barcode(scan_data: ScanRequest, db: Session = Depends(get_db)):
    """掃描條碼驗證"""
    code = scan_data.code
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
        # 直接查詢資料庫檢查條碼是否存在
        barcode = db.query(Barcode).filter(Barcode.code == code).first()
        
        if barcode:
            # 條碼存在，檢查是否重複掃描
            current_time = get_taipei_time()
            from datetime import timedelta
            one_second_ago = current_time - timedelta(seconds=1)
            
            recent_scan = db.query(ScanHistory).filter(
                ScanHistory.barcode == code,
                ScanHistory.timestamp > one_second_ago
            ).order_by(ScanHistory.timestamp.desc()).first()
            
            if recent_scan:
                return ScanResponse(
                    result="duplicate", 
                    message="重複掃描！請勿重複操作",
                    barcode=code
                )
            
            # 原子操作：更新掃描次數和時間
            barcode.scan_count += 1
            barcode.last_scan_time = current_time
            
            # 記錄掃描歷史
            scan = ScanHistory(barcode=code, result='success', timestamp=current_time)
            db.add(scan)
            db.commit()
            
            # 返回成功結果
            return ScanResponse(
                result="success",
                message="✅ 收單確認",
                barcode=code,
                scan_count=barcode.scan_count
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
def get_scan_history(limit: int = 10, db: Session = Depends(get_db)):
    """獲取掃描歷史"""
    history = db.query(ScanHistory).order_by(ScanHistory.timestamp.desc()).limit(limit).all()
    return history

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """獲取統計資料"""
    total_barcodes = db.query(Barcode).count()
    # 計算不重複的成功掃描條碼數量
    successful_scans = db.query(ScanHistory.barcode).filter(
        ScanHistory.result == 'success'
    ).distinct().count()
    failed_scans = db.query(ScanHistory).filter(ScanHistory.result == 'error').count()
    
    return StatsResponse(
        total_barcodes=total_barcodes,
        successful_scans=successful_scans,
        failed_scans=failed_scans
    )

@app.post("/api/barcodes/download")
def download_excel(data: DownloadExcelRequest):
    """下載excel"""
    # 將data轉換成excel
    download_data = data.data
    dict_list = [item.model_dump() for item in download_data]
    df = pd.DataFrame(dict_list)
    output = BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=barcodes.xlsx"}
    )


# 創建資料庫表格
def create_tables():
    Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def startup_event():
    create_tables()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)