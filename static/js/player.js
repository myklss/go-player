document.addEventListener('DOMContentLoaded', function() {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoControls = document.getElementById('videoControls');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const startPrompt = document.getElementById('startPrompt');
    const videoTitle = document.getElementById('videoTitle');
    
    let videos = [];
    let currentVideoIndex = 0;
    let controlsVisible = false;
    let controlsTimeout;
    let videoLoaded = false;
    
    // 获取视频列表
    fetch('/api/videos')
        .then(response => response.json())
        .then(data => {
            videos = data.videos;
            if (videos.length > 0) {
                // 只加载第一个视频，但不自动播放
                loadVideo(0);
            } else {
                console.error('没有找到视频文件');
                startPrompt.textContent = "没有找到视频文件";
            }
        })
        .catch(error => {
            console.error('获取视频列表出错:', error);
            startPrompt.textContent = "加载视频出错";
        });
    
    // 获取视频文件名（不含扩展名）
    function getVideoTitle(filename) {
        return filename.replace(/\.[^/.]+$/, ''); // 移除文件扩展名
    }
    
    // 加载视频但不播放
    function loadVideo(index) {
        if (index >= 0 && index < videos.length) {
            videoPlayer.src = '/videos/' + videos[index];
            currentVideoIndex = index;
            updatePlayPauseButton();
            // 加载时显示控制栏
            showControls();
            videoLoaded = true;
            
            // 更新视频标题
            videoTitle.textContent = getVideoTitle(videos[index]);
            
            // 更新提示信息
            timeDisplay.textContent = "点击播放";
        }
    }
    
    // 播放指定索引的视频
    function playVideo(index) {
        if (index >= 0 && index < videos.length) {
            // 如果是新视频，需要先加载
            if (currentVideoIndex !== index) {
                videoPlayer.src = '/videos/' + videos[index];
                currentVideoIndex = index;
                // 更新视频标题
                videoTitle.textContent = getVideoTitle(videos[index]);
            }
            
            // 播放视频
            videoPlayer.play().catch(e => console.error('播放失败:', e));
            updatePlayPauseButton();
            // 播放时显示控制栏，3秒后自动隐藏
            showControls();
            
            // 隐藏开始提示
            hideStartPrompt();
        }
    }
    
    // 隐藏开始提示
    function hideStartPrompt() {
        startPrompt.classList.add('hidden');
    }
    
    // 播放下一个视频
    function playNextVideo() {
        let nextIndex = (currentVideoIndex + 1) % videos.length;
        playVideo(nextIndex);
    }
    
    // 播放上一个视频
    function playPreviousVideo() {
        let prevIndex = (currentVideoIndex - 1 + videos.length) % videos.length;
        playVideo(prevIndex);
    }
    
    // 更新播放/暂停按钮
    function updatePlayPauseButton() {
        playPauseBtn.innerHTML = videoPlayer.paused ? '▶' : '❚❚';
    }
    
    // 格式化时间
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // 更新进度条和时间显示
    function updateProgress() {
        const currentTime = videoPlayer.currentTime;
        const duration = videoPlayer.duration || 0;
        
        if (duration > 0) {
            // 更新进度条
            const percentage = (currentTime / duration) * 100;
            progressBar.style.width = `${percentage}%`;
            
            // 更新时间显示
            timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        }
    }
    
    // 鼠标滚轮事件处理 - 切换视频
    document.addEventListener('wheel', (e) => {
        // 防止事件冒泡和默认行为
        e.preventDefault();
        
        // 根据滚动方向切换视频
        if (e.deltaY > 0) {
            // 向下滚动 - 播放下一个视频
            playNextVideo();
        } else {
            // 向上滚动 - 播放上一个视频
            playPreviousVideo();
        }
    }, { passive: false });
    
    // 触摸事件处理
    let touchStartX = 0;
    let touchStartY = 0;
    const MIN_SWIPE_DISTANCE = 50;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // 根据滑动方向和距离判断操作
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
            // 水平滑动 - 调整播放进度
            const seekTime = deltaX > 0 ? 10 : -10;
            videoPlayer.currentTime += seekTime;
        } else if (Math.abs(deltaY) > MIN_SWIPE_DISTANCE) {
            // 垂直滑动 - 切换视频
            if (deltaY < 0) {
                // 上滑 - 下一个视频
                playNextVideo();
            } else {
                // 下滑 - 上一个视频
                playPreviousVideo();
            }
        }
    });
    
    // 键盘事件处理 - 对应手机的滑动操作
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowUp':
                // 上键 - 对应上滑 - 下一个视频
                playNextVideo();
                break;
            case 'ArrowDown':
                // 下键 - 对应下滑 - 上一个视频
                playPreviousVideo();
                break;
            case 'ArrowRight':
                // 右键 - 对应右滑 - 前进10秒
                videoPlayer.currentTime += 10;
                break;
            case 'ArrowLeft':
                // 左键 - 对应左滑 - 倒退10秒
                videoPlayer.currentTime -= 10;
                break;
            case ' ':
                // 空格键 - 暂停/播放
                togglePlayPause();
                break;
        }
    });
    
    // 暂停/播放切换
    function togglePlayPause() {
        if (videoPlayer.paused) {
            videoPlayer.play();
            hideStartPrompt();
        } else {
            videoPlayer.pause();
        }
        updatePlayPauseButton();
    }
    
    // 显示控制栏
    function showControls() {
        videoControls.classList.add('active');
        controlsVisible = true;
        
        // 只有在视频播放时才设置自动隐藏
        if (!videoPlayer.paused) {
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                hideControls();
            }, 3000);
        }
    }
    
    // 隐藏控制栏
    function hideControls() {
        // 只有在视频播放时才隐藏控制栏
        if (!videoPlayer.paused) {
            videoControls.classList.remove('active');
            controlsVisible = false;
        }
    }
    
    // 点击视频 - 首次点击开始播放，之后是先显示进度条，再点击才暂停/播放
    videoPlayer.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 如果视频还没开始播放（首次加载）
        if (videoPlayer.paused && videoPlayer.currentTime === 0 && videoLoaded) {
            playVideo(currentVideoIndex);
            return;
        }
        
        // 常规的点击逻辑
        if (!controlsVisible) {
            // 如果控制栏不可见，则显示控制栏
            showControls();
        } else {
            // 如果控制栏可见，则暂停/播放视频
            togglePlayPause();
        }
    });
    
    // 点击开始提示也可以开始播放
    startPrompt.addEventListener('click', () => {
        if (videoLoaded) {
            playVideo(currentVideoIndex);
        }
    });
    
    // 防止点击控制栏时触发视频点击事件
    videoControls.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 点击播放/暂停按钮
    playPauseBtn.addEventListener('click', () => {
        // 如果视频还没开始播放（首次加载）
        if (videoPlayer.paused && videoPlayer.currentTime === 0 && videoLoaded) {
            playVideo(currentVideoIndex);
        } else {
            togglePlayPause();
        }
    });
    
    // 点击进度条跳转
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoPlayer.currentTime = pos * videoPlayer.duration;
        updateProgress();
    });
    
    // 监听视频时间更新事件
    videoPlayer.addEventListener('timeupdate', updateProgress);
    
    // 监听视频元数据加载事件
    videoPlayer.addEventListener('loadedmetadata', () => {
        updateProgress();
    });
    
    // 监听视频播放/暂停事件
    videoPlayer.addEventListener('play', () => {
        updatePlayPauseButton();
        hideStartPrompt();
        // 开始播放时显示控制栏，3秒后自动隐藏
        showControls();
    });
    
    videoPlayer.addEventListener('pause', () => {
        updatePlayPauseButton();
        // 视频暂停时保持控制栏可见
        showControls();
        clearTimeout(controlsTimeout);
    });
    
    // 视频播放结束时自动播放下一个
    videoPlayer.addEventListener('ended', () => {
        playNextVideo();
    });
}); 