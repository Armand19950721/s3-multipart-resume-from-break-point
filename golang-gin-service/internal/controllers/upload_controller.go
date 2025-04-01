package controllers

import (
	"net/http"
	"strconv"

	"golang-gin-service/internal/config"
	"golang-gin-service/internal/services"
	"golang-gin-service/internal/utils"

	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/gin-gonic/gin"
)

type UploadController struct {
	uploadSvc *services.UploadService
}

// 取得一個新的 UploadController
func NewUploadController(cfg *config.Config) *UploadController {
	s3Client, _ := utils.NewS3Client(cfg)
	uploadSvc := services.NewUploadService(s3Client)
	return &UploadController{
		uploadSvc: uploadSvc,
	}
}

// StartMultipartUpload Handler
func (uc *UploadController) StartMultipartUpload(c *gin.Context) {
	key := c.Query("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing key"})
		return
	}
	uploadID, err := uc.uploadSvc.StartMultipart(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"uploadId": uploadID,
		"key":      key,
	})
}

// GetPresignUrlForPart Handler
func (uc *UploadController) GetPresignUrlForPart(c *gin.Context) {
	key := c.Query("key")
	uploadID := c.Query("uploadId")
	partNumberStr := c.Query("partNumber")

	if key == "" || uploadID == "" || partNumberStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing params"})
		return
	}
	partNumber, err := strconv.Atoi(partNumberStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid partNumber"})
		return
	}

	url, err := uc.uploadSvc.GetPresignUrl(c.Request.Context(), key, uploadID, int32(partNumber))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"presignUrl": url,
	})
}

// CompleteMultipartUpload Handler
func (uc *UploadController) CompleteMultipartUpload(c *gin.Context) {
	var body struct {
		Key            string                `json:"key"`
		UploadID       string                `json:"uploadId"`
		CompletedParts []types.CompletedPart `json:"completedParts"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if body.Key == "" || body.UploadID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "key or uploadId missing"})
		return
	}

	err := uc.uploadSvc.CompleteUpload(c.Request.Context(), body.Key, body.UploadID, body.CompletedParts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "upload completed"})
}

// AbortMultipartUpload Handler
func (uc *UploadController) AbortMultipartUpload(c *gin.Context) {
	var body struct {
		Key      string `json:"key"`
		UploadID string `json:"uploadId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if body.Key == "" || body.UploadID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "key or uploadId missing"})
		return
	}

	err := uc.uploadSvc.AbortUpload(c.Request.Context(), body.Key, body.UploadID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "upload aborted"})
}
