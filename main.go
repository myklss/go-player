package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v2"
)

type Config struct {
	Server struct {
		IP   string `yaml:"ip"`
		Port string `yaml:"port"`
	} `yaml:"server"`
	Video struct {
		ScanDirs         []string `yaml:"scan_dirs"`
		SupportedFormats []string `yaml:"supported_formats"`
		RandomPlay       bool     `yaml:"random_play"`
	} `yaml:"video"`
	Access struct {
		EnableCode bool   `yaml:"enable_code"`
		AccessCode string `yaml:"access_code"`
	} `yaml:"access"`
}

type VideoManager struct {
	Videos []string
	mutex  sync.RWMutex
}

// 加载配置文件
func loadConfig() *Config {
	config := &Config{}

	data, err := ioutil.ReadFile("config/config.yaml")
	if err != nil {
		log.Fatalf("无法读取配置文件: %v", err)
	}

	err = yaml.Unmarshal(data, config)
	if err != nil {
		log.Fatalf("无法解析配置文件: %v", err)
	}

	return config
}

// 定期扫描视频文件
func (vm *VideoManager) startVideoScanner(config *Config) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	// 立即扫描一次
	vm.scanVideos(config)

	// 定期扫描
	for range ticker.C {
		vm.scanVideos(config)
	}
}

// 扫描目录找视频文件
func (vm *VideoManager) scanVideos(config *Config) {
	var videos []string

	for _, dir := range config.Video.ScanDirs {
		err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if !info.IsDir() {
				ext := filepath.Ext(path)
				for _, format := range config.Video.SupportedFormats {
					if ext == format {
						// 将路径转换为相对于扫描目录的路径
						relPath, err := filepath.Rel(dir, path)
						if err == nil {
							videos = append(videos, relPath)
						}
						break
					}
				}
			}
			return nil
		})

		if err != nil {
			log.Printf("扫描目录 %s 出错: %v", dir, err)
		}
	}

	vm.mutex.Lock()
	vm.Videos = videos
	vm.mutex.Unlock()

	log.Printf("找到 %d 个视频文件", len(videos))
}

// 主页处理函数
func handleIndex(c *gin.Context) {
	c.HTML(http.StatusOK, "index.html", nil)
}

// 获取访问码配置状态
func handleAccessCodeStatus(config *Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"enable_code": config.Access.EnableCode,
		})
	}
}

// 验证访问码
func handleVerifyAccessCode(config *Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Code string `json:"code"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
			return
		}

		if request.Code == config.Access.AccessCode {
			// 设置会话cookie，浏览器关闭时过期，刷新页面不会过期
			// 确保设置了正确的域名和路径
			// SameSite默认为Lax，允许在GET请求中发送cookie
			// HttpOnly设为false允许JavaScript访问cookie
			c.SetCookie("access_verified", "true", 0, "/", "", false, false)
			c.JSON(http.StatusOK, gin.H{"status": "success"})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "failed", "message": "访问码错误"})
		}
	}
}

// 获取视频列表API
func (vm *VideoManager) handleGetVideos(config *Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 如果开启了访问码验证，检查认证状态
		if config.Access.EnableCode {
			// 从cookie中获取认证状态
			_, err := c.Cookie("access_verified")
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error": "需要访问码验证",
				})
				return
			}
		}

		vm.mutex.RLock()
		defer vm.mutex.RUnlock()

		c.JSON(http.StatusOK, gin.H{
			"videos":      vm.Videos,
			"random_play": config.Video.RandomPlay,
		})
	}
}

func main() {
	// 加载配置文件
	config := loadConfig()

	// 初始化视频管理器
	videoManager := &VideoManager{}

	// 启动视频扫描
	go videoManager.startVideoScanner(config)

	// 设置路由
	r := gin.Default()

	// 提供前端页面
	r.LoadHTMLGlob("templates/*")
	r.Static("/static", "./static")
	r.Static("/videos", config.Video.ScanDirs[0])

	// API路由
	r.GET("/", handleIndex)
	r.GET("/api/access-status", handleAccessCodeStatus(config))
	r.POST("/api/verify-access", handleVerifyAccessCode(config))
	r.GET("/api/videos", videoManager.handleGetVideos(config))

	// 启动服务器
	addr := fmt.Sprintf("%s:%s", config.Server.IP, config.Server.Port)
	log.Printf("服务器启动于 %s", addr)
	log.Fatal(r.Run(addr))
}
