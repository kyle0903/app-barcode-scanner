from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import os
from dotenv import load_dotenv
import pytz

# 載入環境變數
load_dotenv()

# 設置台北時區
TAIPEI_TZ = pytz.timezone('Asia/Taipei')

def get_taipei_time():
    """取得台北當前時間"""
    return datetime.now(TAIPEI_TZ)

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
    barcodes = db.query(Barcode).all()
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

@app.delete("/api/barcodes/{barcode_id}", response_model=MessageResponse)
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
    
    # 查找條碼
    barcode = db.query(Barcode).filter(Barcode.code == code).first()
    
    if barcode:
        # 檢查是否為重複掃描（1秒內）
        current_time = get_taipei_time()
        recent_scan = db.query(ScanHistory).filter(
            ScanHistory.barcode == code,
            ScanHistory.timestamp > current_time.replace(microsecond=0)
        ).order_by(ScanHistory.timestamp.desc()).first()
        
        if recent_scan and (current_time - recent_scan.timestamp).total_seconds() < 1:
            return ScanResponse(
                result="duplicate",
                message="重複掃描！請勿重複操作",
                barcode=code
            )
        
        # 更新掃描次數和時間
        barcode.scan_count += 1
        barcode.last_scan_time = get_taipei_time()
        
        # 記錄掃描歷史
        scan = ScanHistory(barcode=code, result='success')
        db.add(scan)
        db.commit()
        
        return ScanResponse(
            result="success",
            message="收單確認",
            barcode=code,
            scan_count=barcode.scan_count
        )
    else:
        # 記錄失敗的掃描
        scan = ScanHistory(barcode=code, result='error')
        db.add(scan)
        db.commit()
        
        return ScanResponse(
            result="error",
            message="非收單項目",
            barcode=code
        )

@app.get("/api/scan-history", response_model=List[ScanHistoryResponse])
def get_scan_history(limit: int = 10, db: Session = Depends(get_db)):
    """獲取掃描歷史"""
    history = db.query(ScanHistory).order_by(ScanHistory.timestamp.desc()).limit(limit).all()
    return history

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """獲取統計資料"""
    total_barcodes = db.query(Barcode).count()
    successful_scans = db.query(ScanHistory).filter(ScanHistory.result == 'success').count()
    failed_scans = db.query(ScanHistory).filter(ScanHistory.result == 'error').count()
    
    return StatsResponse(
        total_barcodes=total_barcodes,
        successful_scans=successful_scans,
        failed_scans=failed_scans
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