FROM node:18-alpine

WORKDIR /app
# 複製本機 build 出來的靜態檔
COPY build ./build

# 安裝 serve
RUN npm install -g serve

EXPOSE 8080

# 用 serve 啟動
CMD ["serve", "-s", "build", "-l", "8080"]
