package routes

import (
	"golang-gin-service/internal/config"
	"golang-gin-service/internal/controllers"
	"golang-gin-service/internal/middlewares"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRouter 負責初始化 gin.Engine, 註冊路由與 middleware
func SetupRouter(cfg *config.Config) *gin.Engine {
	router := gin.Default()

	// 設置信任的代理
	router.SetTrustedProxies([]string{"127.0.0.1"})

	// CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "ETag", "x-amz-request-id", "x-amz-id-2", "x-amz-etag"},
		AllowCredentials: true,
	}))

	// middleware
	router.Use(middlewares.LoggerMiddleware())
	router.Use(gin.Recovery()) // 添加 recovery middleware
	// router.Use(middlewares.AuthMiddleware()) // 如果需要驗證

	// 綁定 controllers
	uploadCtrl := controllers.NewUploadController(cfg)

	// 一些範例路由 (multipart upload流程)
	router.POST("/upload/start", uploadCtrl.StartMultipartUpload)
	router.POST("/upload/presign", uploadCtrl.GetPresignUrlForPart)
	router.POST("/upload/complete", uploadCtrl.CompleteMultipartUpload)
	router.POST("/upload/abort", uploadCtrl.AbortMultipartUpload)

	return router
}
