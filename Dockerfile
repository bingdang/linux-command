# 使用 Node.js 镜像来同时提供静态网站和 API 服务
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000

# 启动服务器（同时提供静态网站和 API）
CMD ["node", "server.js"]
