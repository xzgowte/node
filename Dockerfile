# 使用官方 Node.js 镜像作为基础镜像
FROM node:lts-alpine3.20

# 设置工作目录
WORKDIR /app

# 将应用程序文件复制到容器中
COPY . .

RUN apk add --no-cache ca-certificates libc6-compat coreutils &&\
    npm install

# 设置默认的命令，即启动应用程序
CMD ["npm", "start"]
