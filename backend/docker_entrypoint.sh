#!/bin/bash

set -e

# 等待資料庫準備就緒
echo "等待 PostgreSQL 資料庫準備就緒..."

while ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "PostgreSQL 尚未準備就緒，等待中..."
  sleep 2
done

echo "PostgreSQL 已準備就緒！"

# 初始化資料庫
echo "初始化資料庫..."
python database.py

# 啟動應用程式
echo "啟動 FastAPI 應用程式..."
exec "$@"
