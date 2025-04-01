package utils

import (
	"context"
	"fmt"

	// 幫 AWS 原生 config 取別名 awsconfig，避免與 internal/config 混淆
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	// 若要使用靜態憑證
	"github.com/aws/aws-sdk-go-v2/credentials"
	// 幫 AWS S3 package 取別名 s3lib
	s3lib "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	// 幫自己的設定結構取別名 mycfg
	mycfg "golang-gin-service/internal/config"
)

var (
	prefixedKeyGlobal = "blender-render/large-video-input/"
)

// S3Client 用於封裝 AWS S3 Client + Bucket
type S3Client struct {
	Client *s3lib.Client
	Bucket string
}

// NewS3Client 依照你自訂的 mycfg.Config 建立 AWS S3 客戶端
func NewS3Client(cfg *mycfg.Config) (*S3Client, error) {
	// 建立靜態憑證提供者
	creds := credentials.NewStaticCredentialsProvider(cfg.AWSAccessKey, cfg.AWSSecretKey, "")

	// 將你自己 cfg 中的 region、access key 等，注入 AWS SDK config
	awsCfg, err := awsconfig.LoadDefaultConfig(
		context.TODO(),
		awsconfig.WithRegion(cfg.AWSRegion),
		awsconfig.WithCredentialsProvider(creds),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load aws config: %v", err)
	}

	// 用 awsCfg 初始化 S3 客戶端
	client := s3lib.NewFromConfig(awsCfg)

	return &S3Client{
		Client: client,
		Bucket: cfg.S3BucketName, // 來自你自己的設定
	}, nil
}

// CreateMultipartUpload 建立一個新的 Multipart Upload，取得 uploadId
func (s *S3Client) CreateMultipartUpload(ctx context.Context, key string) (*s3lib.CreateMultipartUploadOutput, error) {
	// 添加預設路徑前綴
	prefixedKey := prefixedKeyGlobal + key
	input := &s3lib.CreateMultipartUploadInput{
		Bucket: &s.Bucket,
		Key:    &prefixedKey,
	}
	return s.Client.CreateMultipartUpload(ctx, input)
}

// GetPresignedPartURL 取得某個 Part 的上傳 Presign URL
func (s *S3Client) GetPresignedPartURL(ctx context.Context, key string, uploadID string, partNumber int32) (string, error) {
	// 添加預設路徑前綴
	prefixedKey := prefixedKeyGlobal + key
	presigner := s3lib.NewPresignClient(s.Client)
	input := &s3lib.UploadPartInput{
		Bucket:   &s.Bucket,
		Key:      &prefixedKey,
		UploadId: &uploadID,
		// 注意 PartNumber 是 *int32，所以要傳指標
		PartNumber: &partNumber,
	}
	req, err := presigner.PresignUploadPart(ctx, input)
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

// CompleteMultipartUpload 組合所有 Part 的 ETag 後，呼叫 S3 完成整個上傳
func (s *S3Client) CompleteMultipartUpload(ctx context.Context, key string, uploadID string, parts []types.CompletedPart) error {
	// 添加預設路徑前綴
	prefixedKey := prefixedKeyGlobal + key
	input := &s3lib.CompleteMultipartUploadInput{
		Bucket:   &s.Bucket,
		Key:      &prefixedKey,
		UploadId: &uploadID,
		MultipartUpload: &types.CompletedMultipartUpload{
			Parts: parts,
		},
	}

	_, err := s.Client.CompleteMultipartUpload(ctx, input)
	return err
}

// AbortMultipartUpload 放棄一個未完成的 Multipart Upload
func (s *S3Client) AbortMultipartUpload(ctx context.Context, key, uploadID string) error {
	// 添加預設路徑前綴
	prefixedKey := prefixedKeyGlobal + key
	_, err := s.Client.AbortMultipartUpload(ctx, &s3lib.AbortMultipartUploadInput{
		Bucket:   &s.Bucket,
		Key:      &prefixedKey,
		UploadId: &uploadID,
	})
	return err
}
