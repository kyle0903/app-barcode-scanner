"""
資料庫初始化和配置
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app import Base, DATABASE_URL
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

def create_database_if_not_exists():
    """如果資料庫不存在則創建"""
    # 解析資料庫 URL
    postgres_host = os.getenv("POSTGRES_HOST")
    postgres_port = os.getenv("POSTGRES_PORT")
    postgres_user = os.getenv("POSTGRES_USER")
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    postgres_db = os.getenv("POSTGRES_DB")
    
    try:
        # 連接到 PostgreSQL 預設資料庫
        conn = psycopg2.connect(
            host=postgres_host,
            port=postgres_port,
            user=postgres_user,
            password=postgres_password,
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # 檢查資料庫是否存在
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{postgres_db}'")
        exists = cursor.fetchone()
        
        if not exists:
            # 創建資料庫
            cursor.execute(f'CREATE DATABASE "{postgres_db}"')
            print(f"資料庫 '{postgres_db}' 創建成功")
        else:
            print(f"資料庫 '{postgres_db}' 已存在")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"創建資料庫時發生錯誤: {e}")
        return False
    
    return True

def init_database():
    """初始化資料庫表格"""
    try:
        create_database_if_not_exists()
        
        # 創建引擎和表格
        engine = create_engine(DATABASE_URL)
        Base.metadata.create_all(bind=engine)
        print("資料庫表格創建成功")
        
        return True
        
    except Exception as e:
        print(f"初始化資料庫時發生錯誤: {e}")
        return False

if __name__ == "__main__":
    print("開始初始化資料庫...")
    if init_database():
        print("資料庫初始化完成！")
    else:
        print("資料庫初始化失敗！")
