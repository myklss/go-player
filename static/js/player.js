document.addEventListener('DOMContentLoaded', function() {
    const videoPlayer = document.getElementById('videoPlayer');
    const nextVideoPlayer = document.getElementById('nextVideoPlayer');
    const videoControls = document.getElementById('videoControls');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const startPrompt = document.getElementById('startPrompt');
    const videoTitle = document.getElementById('videoTitle');
    const videoContainer = document.querySelector('.video-container');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    // 访问码相关元素
    const accessCodeOverlay = document.getElementById('accessCodeOverlay');
    const accessCodeInput = document.getElementById('accessCodeInput');
    const accessCodeSubmit = document.getElementById('accessCodeSubmit');
    const accessCodeError = document.getElementById('accessCodeError');
    
    let videos = [];
    let currentVideoIndex = 0;
    let nextVideoIndex = 0;
    let controlsVisible = false;
    let controlsTimeout;
    let videoLoaded = false;
    let isFullScreen = false;
    let isTransitioning = false;
    let accessVerified = false;
    
    // 检测是否是移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 初始化播放器
    function initPlayer() {
        // 检查访问码状态
        checkAccessCodeStatus();
        
        setupFullscreenSupport();
        preventPageScroll();
        
        // 获取视频列表
        fetch('/api/videos')
            .then(response => {
                if (response.status === 401) {
                    // 如果返回401未授权，显示访问码输入界面
                    showAccessCodeOverlay();
                    return Promise.reject('需要访问码验证');
                }
                return response.json();
            })
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
                if (error !== '需要访问码验证') {
                    startPrompt.textContent = "加载视频出错";
                }
            });
            
        // 设置访问码提交事件
        setupAccessCodeEvents();
    }
    
    // 检查是否需要访问码验证
    function checkAccessCodeStatus() {
        fetch('/api/access-status')
            .then(response => response.json())
            .then(data => {
                if (data.enable_code) {
                    // 检查是否已经验证过（cookie）
                    // 更准确的cookie检测方法
                    const cookies = document.cookie.split(';');
                    let hasAccessCookie = false;
                    
                    for (let i = 0; i < cookies.length; i++) {
                        const cookie = cookies[i].trim();
                        if (cookie.startsWith('access_verified=true')) {
                            hasAccessCookie = true;
                            break;
                        }
                    }
                    
                    console.log("访问码验证状态:", hasAccessCookie ? "已验证" : "未验证", document.cookie);
                    
                    if (!hasAccessCookie) {
                        showAccessCodeOverlay();
                    } else {
                        // 已验证
                        accessVerified = true;
                        hideAccessCodeOverlay();
                    }
                } else {
                    // 不需要访问码验证
                    accessVerified = true;
                    hideAccessCodeOverlay();
                }
            })
            .catch(error => {
                console.error('获取访问码状态出错:', error);
            });
    }
    
    // 显示访问码输入界面
    function showAccessCodeOverlay() {
        accessCodeOverlay.classList.remove('hidden');
    }
    
    // 隐藏访问码输入界面
    function hideAccessCodeOverlay() {
        accessCodeOverlay.classList.add('hidden');
    }
    
    // 设置访问码相关事件
    function setupAccessCodeEvents() {
        // 提交按钮点击事件
        accessCodeSubmit.addEventListener('click', verifyAccessCode);
        
        // 输入框回车事件
        accessCodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                verifyAccessCode();
            }
        });
    }
    
    // 验证访问码
    function verifyAccessCode() {
        const code = accessCodeInput.value.trim();
        
        if (!code) {
            accessCodeError.textContent = "请输入访问码";
            return;
        }
        
        fetch('/api/verify-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 验证成功
                accessVerified = true;
                hideAccessCodeOverlay();
                
                // 重新获取视频列表
                fetch('/api/videos')
                    .then(response => response.json())
                    .then(data => {
                        videos = data.videos;
                        if (videos.length > 0) {
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
            } else {
                // 验证失败
                accessCodeError.textContent = data.message || "访问码错误";
                accessCodeInput.value = '';
                accessCodeInput.focus();
            }
        })
        .catch(error => {
            console.error('验证访问码出错:', error);
            accessCodeError.textContent = "验证失败，请稍后再试";
        });
    }
    
    // 防止页面滚动，特别是在移动设备上
    function preventPageScroll() {
        document.body.addEventListener('touchmove', function(e) {
            // 仅在滑动视频区域时才阻止页面滚动
            if (e.target === videoPlayer || e.target.closest('.video-container')) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // 设置全屏支持
    function setupFullscreenSupport() {
        // 双击进入/退出全屏
        videoPlayer.addEventListener('dblclick', toggleFullScreen);
        
        // 点击全屏按钮进入/退出全屏
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullScreen();
        });
        
        // 监听全屏变化
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);
        document.addEventListener('mozfullscreenchange', onFullscreenChange);
        document.addEventListener('MSFullscreenChange', onFullscreenChange);
    }
    
    // 切换全屏状态
    function toggleFullScreen() {
        // 记录当前的全屏状态
        const isCurrentlyFullScreen = !!(document.fullscreenElement || 
                      document.mozFullScreenElement || 
                      document.webkitFullscreenElement || 
                      document.msFullscreenElement);
        
        // 记录当前播放状态
        const wasPlaying = !videoPlayer.paused;
        
        console.log("切换全屏状态，当前是否全屏:", isCurrentlyFullScreen, "是否播放中:", wasPlaying);
        
        if (!isCurrentlyFullScreen) {
            // 进入全屏
            console.log("尝试进入全屏");
            if (videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen().catch(err => {
                    console.error("全屏请求失败:", err);
                });
            } else if (videoContainer.mozRequestFullScreen) {
                videoContainer.mozRequestFullScreen();
            } else if (videoContainer.webkitRequestFullscreen) {
                videoContainer.webkitRequestFullscreen();
            } else if (videoContainer.msRequestFullscreen) {
                videoContainer.msRequestFullscreen();
            } else if (isMobile && videoPlayer.webkitEnterFullscreen) {
                // 对于iOS设备，记录要退出全屏时恢复的播放状态
                videoPlayer.setAttribute('data-was-playing', wasPlaying ? 'true' : 'false');
                videoPlayer.webkitEnterFullscreen();
            } else {
                console.error("浏览器不支持全屏API");
            }
        } else {
            // 退出全屏
            console.log("尝试退出全屏");
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.error("退出全屏失败:", err);
                });
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else {
                console.error("浏览器不支持退出全屏API");
            }
            
            // 在移动设备上可能需要额外处理来恢复播放状态
            if (isMobile && wasPlaying) {
                // 立即隐藏加载提示
                hideStartPrompt();
                
                setTimeout(() => {
                    if (videoPlayer.paused) {
                        console.log("移动设备退出全屏后恢复播放");
                        videoPlayer.play().catch(e => {
                            console.error("恢复播放失败:", e);
                        });
                    }
                }, 300); // 移动设备可能需要更长的延迟
            }
        }
    }
    
    // 处理全屏状态变化
    function onFullscreenChange() {
        const wasFullScreen = isFullScreen;
        const wasPlaying = !videoPlayer.paused;
        
        isFullScreen = !!(document.fullscreenElement || 
                          document.mozFullScreenElement || 
                          document.webkitFullscreenElement || 
                          document.msFullscreenElement);
        
        // 根据全屏状态调整界面
        if (isFullScreen) {
            // 进入全屏后，锁定屏幕方向为横屏（如果支持）
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(e => {
                    console.log('屏幕方向锁定失败:', e);
                });
            }
        } else {
            // 退出全屏后，解锁屏幕方向（如果支持）
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
            
            // 如果退出全屏前视频正在播放，确保退出后继续播放
            if (wasPlaying) {
                console.log('退出全屏，保持视频播放状态');
                // 使用setTimeout确保在浏览器处理完全屏事件后执行
                setTimeout(() => {
                    if (videoPlayer.paused) {
                        videoPlayer.play().catch(e => {
                            console.error('退出全屏后继续播放失败:', e);
                        });
                    }
                }, 100);
            }
        }
    }
    
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
            
            // 强制设置视频初始方向（如果是移动设备）
            if (isMobile) {
                videoPlayer.style.objectFit = 'contain';
                nextVideoPlayer.style.objectFit = 'contain';
            }
            
            // 预加载下一个视频
            preloadNextVideo((index + 1) % videos.length);
        }
    }
    
    // 预加载下一个视频
    function preloadNextVideo(index) {
        if (index >= 0 && index < videos.length) {
            nextVideoPlayer.src = '/videos/' + videos[index];
            nextVideoIndex = index;
            nextVideoPlayer.load();
        }
    }
    
    // 平滑切换到下一个视频
    function smoothSwitchVideo(index) {
        if (isTransitioning || index === currentVideoIndex || index < 0 || index >= videos.length) {
            return;
        }
        
        isTransitioning = true;
        console.log("平滑切换到视频:", index);
        
        // 记录当前播放状态和进度
        const wasPlaying = !videoPlayer.paused;
        
        // 如果下一个视频已经预加载好并且就是我们要播放的
        if (nextVideoIndex === index) {
            // 准备淡入淡出效果
            videoPlayer.style.opacity = '1';
            nextVideoPlayer.style.opacity = '0';
            
            // 准备播放已预加载的下一个视频
            const playNextPromise = nextVideoPlayer.play();
            if (playNextPromise !== undefined) {
                playNextPromise.catch(e => {
                    console.error('播放下一个视频失败:', e);
                });
            }
            
            // 淡入淡出切换
            setTimeout(() => {
                nextVideoPlayer.style.opacity = '1';
                videoPlayer.style.opacity = '0';
                
                // 更新视频标题
                videoTitle.textContent = getVideoTitle(videos[index]);
                
                // 等待淡入淡出效果完成
                setTimeout(() => {
                    // 交换两个播放器的角色
                    const tempSrc = videoPlayer.src;
                    videoPlayer.src = nextVideoPlayer.src;
                    videoPlayer.currentTime = nextVideoPlayer.currentTime;
                    
                    if (wasPlaying) {
                        videoPlayer.play();
                    }
                    
                    // 重置样式
                    videoPlayer.style.opacity = '1';
                    nextVideoPlayer.style.opacity = '0';
                    
                    // 更新索引和预加载下一个视频
                    currentVideoIndex = index;
                    preloadNextVideo((index + 1) % videos.length);
                    
                    isTransitioning = false;
                }, 500); // 与CSS过渡时间匹配
            }, 10);
        } else {
            // 如果预加载的不是我们需要的视频，则直接加载
            nextVideoPlayer.src = '/videos/' + videos[index];
            nextVideoIndex = index;
            
            // 等待新视频加载足够的数据
            nextVideoPlayer.oncanplay = function() {
                // 清除事件监听器以防重复触发
                nextVideoPlayer.oncanplay = null;
                
                // 准备淡入淡出效果
                videoPlayer.style.opacity = '1';
                nextVideoPlayer.style.opacity = '0';
                
                // 准备播放已加载的视频
                nextVideoPlayer.play().catch(e => {
                    console.error('播放下一个视频失败:', e);
                });
                
                // 淡入淡出切换
                setTimeout(() => {
                    nextVideoPlayer.style.opacity = '1';
                    videoPlayer.style.opacity = '0';
                    
                    // 更新视频标题
                    videoTitle.textContent = getVideoTitle(videos[index]);
                    
                    // 等待淡入淡出效果完成
                    setTimeout(() => {
                        // 交换两个播放器的角色
                        const tempSrc = videoPlayer.src;
                        videoPlayer.src = nextVideoPlayer.src;
                        videoPlayer.currentTime = nextVideoPlayer.currentTime;
                        
                        if (wasPlaying) {
                            videoPlayer.play();
                        }
                        
                        // 重置样式
                        videoPlayer.style.opacity = '1';
                        nextVideoPlayer.style.opacity = '0';
                        
                        // 更新索引和预加载下一个视频
                        currentVideoIndex = index;
                        preloadNextVideo((index + 1) % videos.length);
                        
                        isTransitioning = false;
                    }, 500); // 与CSS过渡时间匹配
                }, 10);
            };
            
            // 处理加载超时
            setTimeout(() => {
                if (isTransitioning) {
                    console.log("视频加载超时，使用普通切换");
                    // 如果超过3秒还没加载好，使用普通方式切换
                    isTransitioning = false;
                    playVideo(index);
                }
            }, 3000);
        }
    }
    
    // 播放指定索引的视频
    function playVideo(index) {
        if (index >= 0 && index < videos.length) {
            // 如果是新视频，需要先加载
            if (currentVideoIndex !== index) {
                // 尝试平滑切换
                smoothSwitchVideo(index);
                return;
            }
            
            // 播放视频
            const playPromise = videoPlayer.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.error('播放失败:', e);
                    // 在某些移动设备上，需要用户交互才能播放
                    if (e.name === 'NotAllowedError') {
                        startPrompt.classList.remove('hidden');
                        startPrompt.textContent = "点击屏幕开始播放";
                    }
                });
            }
            
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
    let touchStartTime = 0;
    const MIN_SWIPE_DISTANCE = 50;
    const MAX_TAP_DURATION = 200; // 毫秒
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    });
    
    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchDuration = Date.now() - touchStartTime;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // 如果是短暂触摸（类似点击），则处理为点击事件
        if (touchDuration < MAX_TAP_DURATION && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            return; // 让点击事件处理器来处理
        }
        
        // 根据滑动方向和距离判断操作
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
            // 水平滑动 - 调整播放进度
            const seekTime = deltaX > 0 ? 10 : -10;
            videoPlayer.currentTime += seekTime;
            
            // 显示控制栏，让用户看到进度变化
            showControls();
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
            case 'f':
            case 'F':
                // F键 - 全屏
                toggleFullScreen();
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
    
    // 进度条拖动（移动设备上的滑动）
    let isDraggingProgress = false;
    
    progressContainer.addEventListener('touchstart', (e) => {
        isDraggingProgress = true;
        updateProgressFromTouch(e.touches[0]);
        e.stopPropagation();
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (isDraggingProgress) {
            updateProgressFromTouch(e.touches[0]);
            e.stopPropagation();
        }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
        isDraggingProgress = false;
    });
    
    function updateProgressFromTouch(touch) {
        const rect = progressContainer.getBoundingClientRect();
        let pos = (touch.clientX - rect.left) / rect.width;
        
        // 确保pos在0-1范围内
        pos = Math.max(0, Math.min(1, pos));
        
        videoPlayer.currentTime = pos * videoPlayer.duration;
        updateProgress();
    }
    
    // 监听视频时间更新事件
    videoPlayer.addEventListener('timeupdate', updateProgress);
    
    // 监听视频元数据加载事件
    videoPlayer.addEventListener('loadedmetadata', () => {
        updateProgress();
        
        // 在移动设备上，可能需要设置初始播放方向
        if (isMobile) {
            if (videoPlayer.videoWidth > videoPlayer.videoHeight) {
                // 横向视频，尝试横屏
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            }
        }
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
    
    // 处理屏幕方向变化
    window.addEventListener('orientationchange', () => {
        // 给UI一点时间来适应新的方向
        setTimeout(() => {
            // 可能需要重新调整视频大小和位置
            updateVideoContainerSize();
        }, 300);
    });
    
    // 更新视频容器大小
    function updateVideoContainerSize() {
        // 根据当前屏幕方向做适当的调整
        if (window.orientation === 90 || window.orientation === -90) {
            // 横屏
            videoPlayer.style.objectFit = 'contain';
        } else {
            // 竖屏
            videoPlayer.style.objectFit = 'contain';
        }
    }
    
    // 处理错误
    videoPlayer.addEventListener('error', () => {
        console.error('视频加载错误:', videoPlayer.error);
        startPrompt.classList.remove('hidden');
        startPrompt.textContent = "视频加载失败，请尝试其他视频";
    });
    
    // 处理网络状态变化
    videoPlayer.addEventListener('stalled', () => {
        // 只有在非全屏模式和iOS设备退出全屏过程中才显示加载提示
        if (!isFullScreen && !(isMobile && videoPlayer.hasAttribute('data-was-playing'))) {
            startPrompt.classList.remove('hidden');
            startPrompt.textContent = "视频加载中...";
        }
    });
    
    videoPlayer.addEventListener('canplay', () => {
        if (startPrompt.textContent === "视频加载中...") {
            hideStartPrompt();
        }
    });
    
    // 添加专门监听iOS全屏事件
    if (isMobile) {
        // iOS设备上的webkitfullscreenchange事件可能不会触发
        // 使用webkitendfullscreen事件来处理iOS上的全屏退出
        videoPlayer.addEventListener('webkitendfullscreen', () => {
            console.log("iOS设备检测到退出全屏");
            const wasPlaying = videoPlayer.getAttribute('data-was-playing') === 'true';
            console.log("iOS设备退出全屏时播放状态:", wasPlaying);
            
            // 立即隐藏加载提示，防止显示"视频加载中"
            hideStartPrompt();
            
            if (wasPlaying) {
                console.log("iOS设备恢复播放状态");
                
                // 延长恢复播放的延迟时间，确保视频状态已稳定
                setTimeout(() => {
                    if (videoPlayer.paused) {
                        console.log("尝试恢复iOS设备视频播放");
                        
                        const playPromise = videoPlayer.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => {
                                console.error("iOS设备恢复播放失败:", e);
                                // 如果第一次尝试失败，再次尝试
                                setTimeout(() => {
                                    videoPlayer.play().catch(e2 => {
                                        console.error("iOS设备第二次恢复播放失败:", e2);
                                    });
                                }, 300);
                            });
                        }
                    }
                }, 500);
            }
        });
    }
    
    // 初始化播放器
    initPlayer();
}); 