package config

import (
	"fmt"
	"os"
)

type Config struct {
	AWSAccessKey string
	AWSSecretKey string
	AWSRegion    string
	S3BucketName string
	// 也可加上其他自定義參數，例如DB連線、PORT、JWT Secret等
}

func LoadConfig() (*Config, error) {
	cfg := &Config{
		AWSAccessKey: os.Getenv("AWS_S3_IP"),
		AWSSecretKey: os.Getenv("AWS_S3_SECRET"),
		AWSRegion:    "ap-northeast-1", // 設定預設區域
		S3BucketName: os.Getenv("AWS_S3_BUCKET"),
	}

	// 檢查必要參數
	if cfg.AWSAccessKey == "" {
		return nil, fmt.Errorf("AWS_S3_IP not set")
	}
	if cfg.AWSSecretKey == "" {
		return nil, fmt.Errorf("AWS_S3_SECRET not set")
	}
	if cfg.S3BucketName == "" {
		return nil, fmt.Errorf("AWS_S3_BUCKET not set")
	}
	return cfg, nil
}
