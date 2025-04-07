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
    let randomPlay = false;
    let playHistory = []; // 添加播放历史记录
    let historyIndex = -1; // 历史索引位置
    
    // 检测是否是移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 添加拖动进度条状态标记
    let isUserSeeking = false;
    
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
                randomPlay = data.random_play; // 设置随机播放状态
                console.log("随机播放模式:", randomPlay ? "开启" : "关闭");
                
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
                        randomPlay = data.random_play; // 设置随机播放状态
                        console.log("随机播放模式:", randomPlay ? "开启" : "关闭");
                        
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
            
            // 更新播放历史
            playHistory = [index]; // 重置播放历史，只保留当前索引
            historyIndex = 0;
            
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
            
            // 预加载下一个视频（无论是否为随机模式）
            preloadNextVideo();
        }
    }
    
    // 预加载下一个视频
    function preloadNextVideo() {
        let nextIndex;
        
        if (randomPlay && videos.length > 1) {
            // 随机模式下，预先决定下一个随机视频
            const randomIndex = Math.floor(Math.random() * (videos.length - 1));
            // 避免选中当前视频
            nextIndex = randomIndex >= currentVideoIndex ? randomIndex + 1 : randomIndex;
            console.log("预加载随机视频:", nextIndex, "文件名:", videos[nextIndex]);
        } else {
            // 顺序模式
            nextIndex = (currentVideoIndex + 1) % videos.length;
        }
        
        if (nextIndex >= 0 && nextIndex < videos.length) {
            nextVideoPlayer.src = '/videos/' + videos[nextIndex];
            nextVideoIndex = nextIndex;
            nextVideoPlayer.load();
        }
    }
    
    // 平滑切换到下一个视频
    function smoothSwitchVideo(index, addToHistory = true) {
        if (isTransitioning || index === currentVideoIndex || index < 0 || index >= videos.length) {
            return;
        }
        
        isTransitioning = true;
        console.log("平滑切换到视频:", index);
        
        // 记录当前播放状态和进度
        const wasPlaying = !videoPlayer.paused;
        
        // 如果需要添加到历史记录
        if (addToHistory) {
            // 如果从历史记录中的某个点继续播放，则删除该点之后的所有历史
            if (historyIndex >= 0 && historyIndex < playHistory.length - 1) {
                playHistory = playHistory.slice(0, historyIndex + 1);
            }
            
            // 添加到播放历史
            playHistory.push(index);
            historyIndex = playHistory.length - 1;
            console.log("播放历史:", playHistory, "当前位置:", historyIndex);
        }
        
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
                    
                    // 预加载下一个视频(无论是否为随机模式)
                    preloadNextVideo();
                    
                    isTransitioning = false;
                }, 500); // 与CSS过渡时间匹配
            }, 10);
        } else {
            // 如果预加载的不是我们需要的视频，则直接加载
            
            // 先隐藏播放器避免短时间内的黑屏问题
            videoPlayer.style.opacity = '0';
            
            // 避免重复加载相同的资源
            if (videoPlayer.src !== '/videos/' + videos[index]) {
                videoPlayer.src = '/videos/' + videos[index];
            }
            currentVideoIndex = index;
            
            // 更新视频标题
            videoTitle.textContent = getVideoTitle(videos[index]);
            
            // 在加载完成后播放并淡入
            videoPlayer.oncanplay = function() {
                // 清除事件监听器以防重复触发
                videoPlayer.oncanplay = null;
                
                if (wasPlaying) {
                    videoPlayer.play();
                }
                
                // 淡入新视频
                setTimeout(() => {
                    videoPlayer.style.opacity = '1';
                    
                    // 预加载下一个视频(无论是否为随机模式)
                    preloadNextVideo();
                    
                    isTransitioning = false;
                }, 10);
            };
            
            // 处理加载超时
            setTimeout(() => {
                if (isTransitioning) {
                    console.log("视频加载超时，尝试直接播放");
                    if (wasPlaying) {
                        videoPlayer.play();
                    }
                    videoPlayer.style.opacity = '1';
                    isTransitioning = false;
                    
                    // 即使加载超时也要预加载下一个视频
                    preloadNextVideo();
                }
            }, 2000);
        }
    }
    
    // 播放指定索引的视频
    function playVideo(index, addToHistory = true) {
        if (index >= 0 && index < videos.length) {
            // 清除可能的"即将结束"标记
            videoPlayer.removeAttribute('data-ending-soon');
            
            // 如果是新视频，需要先加载
            if (currentVideoIndex !== index) {
                // 尝试平滑切换
                smoothSwitchVideo(index, addToHistory);
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
        let nextIndex;
        
        if (randomPlay && videos.length > 1) {
            // 使用已经预加载的随机视频（如果存在）
            if (nextVideoIndex >= 0 && nextVideoIndex != currentVideoIndex) {
                nextIndex = nextVideoIndex;
            } else {
                // 否则生成新的随机索引
                const randomIndex = Math.floor(Math.random() * (videos.length - 1));
                // 避免选中当前视频
                nextIndex = randomIndex >= currentVideoIndex ? randomIndex + 1 : randomIndex;
            }
            console.log("随机播放下一个视频:", nextIndex);
        } else {
            // 顺序模式
            nextIndex = (currentVideoIndex + 1) % videos.length;
        }
        
        playVideo(nextIndex, true);
    }
    
    // 播放上一个视频
    function playPreviousVideo() {
        // 如果有播放历史并且不是在第一个位置
        if (playHistory.length > 1 && historyIndex > 0) {
            // 从历史记录中获取上一个视频
            historyIndex--;
            const prevIndex = playHistory[historyIndex];
            console.log("播放历史记录中的上一个视频:", prevIndex);
            
            // 播放上一个视频，不添加到历史中
            playVideo(prevIndex, false);
        } else {
            // 如果没有历史记录或者在第一个位置，则按顺序播放上一个
            let prevIndex = (currentVideoIndex - 1 + videos.length) % videos.length;
            playVideo(prevIndex, true);
        }
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
        
        if (duration > 0 && !isNaN(duration) && !isNaN(currentTime)) {
            // 更新进度条
            const percentage = (currentTime / duration) * 100;
            progressBar.style.width = `${percentage}%`;
            
            // 更新时间显示
            timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        }
    }
    
    // 立即强制更新进度条，用于确保UI与视频时间同步
    function forceUpdateProgress() {
        requestAnimationFrame(updateProgress);
    }
    
    // 监听视频时间更新事件
    videoPlayer.addEventListener('timeupdate', updateProgress);
    
    // 添加更多触发进度更新的事件
    ['playing', 'seeking', 'seeked', 'canplay', 'loadedmetadata', 'loadeddata'].forEach(event => {
        videoPlayer.addEventListener(event, forceUpdateProgress);
    });
    
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
    let touchLastX = 0;
    let isSeeking = false;
    let seekStartTime = 0;
    let lastSeekTime = 0;
    let originalVideoTime = 0;
    let cumulativeSeekOffset = 0;
    const MIN_SWIPE_DISTANCE = 50;
    const MAX_TAP_DURATION = 200; // 毫秒
    
    document.addEventListener('touchstart', (e) => {
        // 如果点击在视频上才处理快进快退
        if (!e.target.closest('.video-container') || accessCodeOverlay.classList.contains('hidden') === false) {
            return;
        }
        
        touchStartX = e.touches[0].clientX;
        touchLastX = touchStartX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        
        // 如果视频已经加载，准备可能的快进快退操作
        if (videoLoaded && !videoPlayer.paused) {
            seekStartTime = Date.now();
            originalVideoTime = videoPlayer.currentTime;
            isSeeking = false;
            cumulativeSeekOffset = 0;
            
            // 显示控制栏
            showControls();
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        // 如果不是在视频容器内触摸，或者在进度条上拖动，则忽略快进快退逻辑
        if (!e.target.closest('.video-container') || isDraggingProgress || 
            accessCodeOverlay.classList.contains('hidden') === false) {
            return;
        }
        
        const touchCurrentX = e.touches[0].clientX;
        const touchCurrentY = e.touches[0].clientY;
        const deltaX = touchCurrentX - touchStartX;
        const deltaY = touchCurrentY - touchStartY;
        const movementX = touchCurrentX - touchLastX;
        touchLastX = touchCurrentX;
        
        // 检测是水平滑动还是垂直滑动
        if (!isSeeking && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
            isSeeking = true;
            // 添加一个视觉指示，显示正在快进或快退
            startPrompt.classList.remove('hidden');
            startPrompt.textContent = "快进/快退中...";
        }
        
        // 如果是水平滑动，执行快进快退
        if (isSeeking && videoLoaded && !videoPlayer.paused) {
            // 计算滑动距离对应的时间调整 (每像素1秒，根据需求调整)
            const seekAdjustment = movementX * 1;
            cumulativeSeekOffset += seekAdjustment;
            
            // 计算新的播放时间
            let newTime = originalVideoTime + cumulativeSeekOffset;
            
            // 确保时间在有效范围内
            newTime = Math.max(0, Math.min(newTime, videoPlayer.duration));
            
            // 更新视频播放时间
            videoPlayer.currentTime = newTime;
            
            // 更新快进快退指示
            const direction = seekAdjustment > 0 ? "快进" : "快退";
            const secondsDisplay = Math.abs(cumulativeSeekOffset).toFixed(1);
            startPrompt.textContent = `${direction} ${secondsDisplay} 秒`;
            
            // 确保控制栏可见
            showControls();
            
            // 防止页面滚动
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchDuration = Date.now() - touchStartTime;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // 如果是在进行快进快退，结束后隐藏提示
        if (isSeeking) {
            hideStartPrompt();
            isSeeking = false;
            showControls(); // 确保控制栏可见
            return; // 不执行后面的滑动逻辑
        }
        
        // 如果是短暂触摸（类似点击），则处理为点击事件
        if (touchDuration < MAX_TAP_DURATION && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            return; // 让点击事件处理器来处理
        }
        
        // 处理常规滑动手势
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
        e.stopPropagation(); // 阻止事件冒泡
        
        if (!videoPlayer.duration || isNaN(videoPlayer.duration)) {
            return; // 如果视频未加载或时长无效，则退出
        }
        
        // 标记用户正在手动调整进度
        isUserSeeking = true;
        
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = pos * videoPlayer.duration;
        
        console.log(`进度条点击: 位置=${pos.toFixed(2)}, 目标时间=${newTime.toFixed(2)}秒`);
        
        // 设置视频时间
        videoPlayer.currentTime = newTime;
        
        // 立即更新进度条，不等待timeupdate事件
        updateProgress();
        
        // 重新显示控制栏并重置计时器
        showControls();
        
        // 延迟一小段时间后才取消用户调整标记，避免误触发结束逻辑
        setTimeout(() => {
            isUserSeeking = false;
        }, 1000);
    });
    
    // 进度条拖动（移动设备上的滑动）
    let isDraggingProgress = false;
    
    progressContainer.addEventListener('touchstart', (e) => {
        isDraggingProgress = true;
        isUserSeeking = true; // 标记用户正在手动调整进度
        updateProgressFromTouch(e.touches[0]);
        e.stopPropagation();
        e.preventDefault(); // 防止触发其他事件
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        if (isDraggingProgress) {
            updateProgressFromTouch(e.touches[0]);
            e.stopPropagation();
            e.preventDefault(); // 防止页面滚动
        }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
        if (isDraggingProgress) {
            // 确保最后一次拖动结束后也更新了进度
            if (e.changedTouches && e.changedTouches.length > 0) {
                updateProgressFromTouch(e.changedTouches[0]);
            }
            
            // 拖动结束后重新显示控制栏并重置计时器
            showControls();
            isDraggingProgress = false;
            
            // 确保视频继续播放（如果之前是播放状态）
            if (!videoPlayer.paused) {
                try {
                    videoPlayer.play().catch(err => {
                        console.error("拖动后恢复播放失败:", err);
                    });
                } catch (err) {
                    console.error("尝试恢复播放出错:", err);
                }
            }
            
            // 记录日志，帮助调试
            console.log(`进度条拖动结束: 当前时间=${videoPlayer.currentTime.toFixed(2)}秒`);
            
            // 延迟一小段时间后才取消用户调整标记，避免误触发结束逻辑
            setTimeout(() => {
                isUserSeeking = false;
            }, 1000);
            
            e.stopPropagation();
            e.preventDefault();
        }
    }, { passive: false });
    
    function updateProgressFromTouch(touch) {
        if (!videoPlayer.duration || isNaN(videoPlayer.duration)) {
            return; // 如果视频未加载或时长无效，则退出
        }
        
        const rect = progressContainer.getBoundingClientRect();
        let pos = (touch.clientX - rect.left) / rect.width;
        
        // 确保pos在0-1范围内
        pos = Math.max(0, Math.min(1, pos));
        
        const newTime = pos * videoPlayer.duration;
        
        // 只有当位置发生明显变化时才更新（防止微小抖动）
        if (Math.abs(videoPlayer.currentTime - newTime) > 0.5) {
            console.log(`拖动进度条: 位置=${pos.toFixed(2)}, 目标时间=${newTime.toFixed(2)}秒`);
            
            try {
                // 设置视频时间
                videoPlayer.currentTime = newTime;
                
                // 确保进度条立即反映更新后的位置
                forceUpdateProgress();
            } catch (err) {
                console.error("设置视频时间失败:", err);
            }
        }
        
        // 无论如何更新UI，保持用户体验流畅
        progressBar.style.width = `${pos * 100}%`;
        
        // 更新时间显示
        if (videoPlayer.duration) {
            timeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(videoPlayer.duration)}`;
        }
    }
    
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
        console.log("视频播放结束事件(ended)触发，准备播放下一个视频");
        // 重要：确保不会因为其他原因忽略播放下一个视频的指令
        setTimeout(() => {
            playNextVideo();
        }, 50);
    });
    
    // 添加备用机制检测视频是否接近结束
    videoPlayer.addEventListener('timeupdate', () => {
        // 如果视频已加载且播放时间接近结束（还剩0.5秒），准备下一个视频
        // 但如果用户正在手动拖动进度条，则不触发自动播放下一个视频
        if (videoLoaded && !videoPlayer.paused && videoPlayer.duration > 0 && !isUserSeeking && !isDraggingProgress) {
            const timeLeft = videoPlayer.duration - videoPlayer.currentTime;
            
            // 记录接近视频结尾的状态，便于调试
            if (timeLeft < 1) {
                console.log(`视频接近结束: 剩余时间=${timeLeft.toFixed(2)}秒, 总时长=${videoPlayer.duration.toFixed(2)}秒`);
            }
            
            // 更保守的阈值，如果距离结束不到0.3秒，也认为已结束
            if (timeLeft > 0 && timeLeft < 0.3) {
                console.log("视频即将结束，准备播放下一个视频");
                
                // 确保只触发一次，通过设置标记
                if (!videoPlayer.hasAttribute('data-ending-soon')) {
                    videoPlayer.setAttribute('data-ending-soon', 'true');
                    
                    // 不等待，直接播放下一个视频
                    // 某些视频格式在最后可能不会触发ended事件
                    console.log("检测到视频已实际播放到最后，手动播放下一个");
                    playNextVideo();
                }
            }
        }
    });
    
    // 监视视频是否卡死在结束位置但没有触发ended事件
    setInterval(() => {
        if (videoLoaded && !videoPlayer.paused && videoPlayer.currentTime > 0 && videoPlayer.duration > 0) {
            // 如果视频播放到最后0.1秒但超过2秒没有变化，认为是卡在结尾
            const timeLeft = videoPlayer.duration - videoPlayer.currentTime;
            if (timeLeft < 0.1 && !isUserSeeking && !isDraggingProgress) {
                const now = Date.now();
                
                if (!videoPlayer.lastTimeUpdateAt) {
                    videoPlayer.lastTimeUpdateAt = now;
                    videoPlayer.lastCurrentTime = videoPlayer.currentTime;
                } else if (now - videoPlayer.lastTimeUpdateAt > 2000 && 
                           Math.abs(videoPlayer.currentTime - videoPlayer.lastCurrentTime) < 0.01) {
                    // 2秒内currentTime几乎没变化，且接近结尾，认为视频卡住了
                    console.log("检测到视频可能卡在结尾位置，强制播放下一个");
                    playNextVideo();
                    // 重置监测状态
                    delete videoPlayer.lastTimeUpdateAt;
                    delete videoPlayer.lastCurrentTime;
                }
            } else {
                // 更新最后检测时间和位置
                videoPlayer.lastTimeUpdateAt = now;
                videoPlayer.lastCurrentTime = videoPlayer.currentTime;
            }
        }
    }, 1000);
    
    // 确保播放视频过程中记录currentTime变化
    videoPlayer.addEventListener('timeupdate', () => {
        if (!videoPlayer.paused) {
            videoPlayer.lastTimeUpdateAt = Date.now();
            videoPlayer.lastCurrentTime = videoPlayer.currentTime;
        }
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
    let loadingPromptTimeout = null;
    
    videoPlayer.addEventListener('stalled', () => {
        // 清除之前的超时
        if (loadingPromptTimeout) {
            clearTimeout(loadingPromptTimeout);
        }
        
        // 延迟显示加载提示，避免短暂网络波动导致错误提示
        loadingPromptTimeout = setTimeout(() => {
            // 仅当视频确实暂停缓冲且尚未足够缓冲时才显示提示
            if (!isFullScreen && 
                !(isMobile && videoPlayer.hasAttribute('data-was-playing')) &&
                videoPlayer.readyState < 3 && // HAVE_FUTURE_DATA(3)以下表示缓冲不足
                !videoPlayer.paused) {  // 确保视频不是用户主动暂停的
                startPrompt.classList.remove('hidden');
                startPrompt.textContent = "视频加载中...";
            }
        }, 1000); // 延迟1秒，避免闪烁
    });
    
    // 监听更多网络和缓冲事件，确保正确隐藏加载提示
    ['canplay', 'playing', 'timeupdate', 'progress'].forEach(event => {
        videoPlayer.addEventListener(event, () => {
            // 清除显示加载提示的超时
            if (loadingPromptTimeout) {
                clearTimeout(loadingPromptTimeout);
                loadingPromptTimeout = null;
            }
            
            // 如果提示是"视频加载中"，则隐藏它
            if (startPrompt.textContent === "视频加载中...") {
                hideStartPrompt();
            }
        });
    });
    
    // 移动端专用检测 - 每5秒检查一次视频是否实际在播放，如果是则确保提示被隐藏
    if (isMobile) {
        setInterval(() => {
            if (!videoPlayer.paused && 
                videoPlayer.currentTime > 0 && 
                startPrompt.textContent === "视频加载中..." && 
                !startPrompt.classList.contains('hidden')) {
                console.log("检测到视频正在播放但提示仍显示，强制隐藏提示");
                hideStartPrompt();
            }
        }, 5000);
    }
    
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