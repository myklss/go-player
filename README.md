# Golang视频播放器

一个使用Golang和Web技术开发的视频播放器，支持Golang的上下滑动切换视频，左右滑动调整播放进度。

## 功能特点

- 自动扫描配置的目录中的视频文件
- Golang的视频播放体验
- 上滑下滑切换视频
- 左右滑动调整播放进度
- 键盘方向键控制
- 视频进度条控制
- 页面加载时默认显示控制栏
- 两步式操作：首次点击开始播放，之后点击显示控制栏再点击暂停/播放
- 支持多种视频格式

## 安装步骤

### 常规安装

1. 克隆本仓库：
```bash
git clone https://github.com/myklss/go-player.git
cd go-player
```

2. 安装依赖：
```bash
go mod tidy
```

3. 修改配置文件(config/config.yaml)：
```yaml
server:
  ip: "127.0.0.1"  # 服务器IP地址
  port: "8080"     # 服务器端口
video:
  scan_dirs:
    - "./videos"   # 视频文件目录
  supported_formats:
    - ".mp4"       # 支持的视频格式
    - ".mkv"
    - ".avi"
```

4. 把你的视频文件放到 `videos` 目录下

5. 编译运行：
```bash
go build
./go-player  # Windows下使用 go-player.exe
```

### Docker构建安装

1. 克隆本仓库：
```bash
git clone https://github.com/myklss/go-player.git
cd go-player
```

2. 使用Docker Compose构建和运行：
```bash
docker-compose up -d
```

3. 或者使用Docker直接构建和运行：
```bash
# 构建Docker镜像
docker build -t go-player .

# 运行容器
docker run -d -p 8080:8080 -v $(pwd)/videos:/app/videos -v $(pwd)/config:/app/config --name go-player go-player
```

4. 将视频文件放到本地的 `videos` 目录下，它会自动映射到容器内。

### Docker直接运行
运行容器
```bash
docker run -d -p 8080:8080 -v $(pwd)/videos:/app/videos -v $(pwd)/config:/app/config --name go-player klss/go-player
```

## 访问应用

打开浏览器，访问 http://127.0.0.1:8080 (或你配置的IP和端口)

## 使用方法

### 触摸控制（移动设备）
- 上滑：切换到下一个视频
- 下滑：切换到上一个视频
- 左滑：倒退10秒
- 右滑：前进10秒
- 点击屏幕：
  - 首次点击：开始播放视频
  - 再次点击（控制栏隐藏时）：显示控制栏和进度条
  - 再次点击（控制栏显示时）：暂停/播放视频

### 键盘控制（电脑）
- ↑ 上方向键：切换到下一个视频（对应上滑）
- ↓ 下方向键：切换到上一个视频（对应下滑）
- ← 左方向键：倒退10秒（对应左滑）
- → 右方向键：前进10秒（对应右滑）
- 空格键：暂停/播放

### 鼠标控制（电脑）
- 滚轮向上滚动：切换到上一个视频
- 滚轮向下滚动：切换到下一个视频
- 点击视频：同触屏操作

### 播放控制
- 页面初始状态：
  - 页面加载时默认显示控制栏和进度条，视频处于暂停状态
  - 首次点击视频或播放按钮开始播放
  - 开始播放几秒后自动隐藏控制栏
- 视频点击逻辑：
  - 首次打开时点击：开始播放视频
  - 控制栏隐藏时点击：显示控制栏和进度条（3秒后自动隐藏）
  - 控制栏显示时点击：暂停/播放视频
- 进度条：可点击跳转到视频的任意位置
- 播放/暂停按钮：控制视频的播放状态
- 视频暂停时控制栏会一直显示，播放时3秒后自动隐藏

## 技术栈

- 后端：Golang + Gin框架
- 前端：HTML5 + JavaScript
- 配置：YAML
- 容器化：Docker

## 许可证

MIT License 
