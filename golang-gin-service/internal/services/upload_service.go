package services

import (
	"context"

	"golang-gin-service/internal/utils"

	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type UploadService struct {
	s3Client *utils.S3Client
}

// 建構函式
func NewUploadService(s3Client *utils.S3Client) *UploadService {
	return &UploadService{s3Client: s3Client}
}

// 建立Multipart上傳
func (u *UploadService) StartMultipart(ctx context.Context, key string) (string, error) {
	out, err := u.s3Client.CreateMultipartUpload(ctx, key)
	if err != nil {
		return "", err
	}
	return *out.UploadId, nil
}

// 取得對應part的Presign URL
func (u *UploadService) GetPresignUrl(ctx context.Context, key string, uploadID string, partNumber int32) (string, error) {
	return u.s3Client.GetPresignedPartURL(ctx, key, uploadID, partNumber)
}

// 完成上傳
func (u *UploadService) CompleteUpload(ctx context.Context, key, uploadID string, parts []types.CompletedPart) error {
	return u.s3Client.CompleteMultipartUpload(ctx, key, uploadID, parts)
}

// 取消上傳
func (u *UploadService) AbortUpload(ctx context.Context, key, uploadID string) error {
	return u.s3Client.AbortMultipartUpload(ctx, key, uploadID)
}
