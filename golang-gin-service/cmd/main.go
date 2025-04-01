package main

import (
	"log"

	"golang-gin-service/internal/config"
	"golang-gin-service/internal/routes"

	"github.com/joho/godotenv"
)

func main() {
	// 載入 .env 檔案
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	// 1. 載入設定 (環境變數, etc.)
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. 初始化Gin路由
	r := routes.SetupRouter(cfg)

	// 3. 啟動Server
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
