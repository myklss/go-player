FROM golang:1.18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装必要的工具
RUN apk add --no-cache git

# 复制 go.mod 和 go.sum 文件并下载依赖
COPY go.mod go.sum* ./
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN go build -o go-player .

# 创建最终运行镜像
FROM alpine:latest

# 安装运行时依赖
RUN apk add --no-cache ca-certificates

# 设置工作目录
WORKDIR /app

# 从构建阶段复制编译好的二进制文件
COPY --from=builder /app/go-player /app/

# 复制静态文件和模板
COPY --from=builder /app/static /app/static
COPY --from=builder /app/templates /app/templates
COPY --from=builder /app/config /app/config

# 创建视频目录
RUN mkdir -p /app/videos

# 暴露端口
EXPOSE 8080

# 设置卷，用于挂载视频文件
VOLUME ["/app/videos", "/app/config"]

# 运行应用
CMD ["/app/go-player"] 