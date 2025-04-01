package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"golang-gin-service/internal/config"
	"golang-gin-service/internal/routes"

	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

var testConfig *config.Config

func init() {
	// 從 .env 檔案載入環境變數
	if err := godotenv.Load("../../.env"); err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	// 檢查環境變數
	log.Printf("AWS_S3_IP: %s", os.Getenv("AWS_S3_IP"))
	log.Printf("AWS_S3_SECRET length: %d", len(os.Getenv("AWS_S3_SECRET")))
	log.Printf("AWS_S3_BUCKET: %s", os.Getenv("AWS_S3_BUCKET"))

	// 使用 LoadConfig 加載配置
	var err error
	testConfig, err = config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 檢查配置
	log.Printf("Config - AWSAccessKey: %s", testConfig.AWSAccessKey)
	log.Printf("Config - AWSSecretKey length: %d", len(testConfig.AWSSecretKey))
	log.Printf("Config - AWSRegion: %s", testConfig.AWSRegion)
	log.Printf("Config - S3BucketName: %s", testConfig.S3BucketName)
}

// 測試用的檔案路徑
const (
	testFilePath = "testdata/test_file.txt"
	// 測試檔案名稱
	testFileName      = "test_file.txt"
	testAbortFileName = "test_abort.txt"
	// 檔案大小設定
	chunkSize = 5 * 1024 * 1024  // 5MB
	fileSize  = 50 * 1024 * 1024 // 50MB
)

// 建立測試檔案
func createTestFile() error {
	// 確保測試目錄存在
	if err := os.MkdirAll("testdata", 0755); err != nil {
		return err
	}

	// 建立一個 50MB 的測試檔案
	file, err := os.Create(testFilePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 寫入一些測試數據
	data := make([]byte, fileSize)
	for i := range data {
		data[i] = byte(i % 256)
	}
	_, err = file.Write(data)
	return err
}

// 清理測試檔案
func cleanupTestFile() {
	os.RemoveAll("testdata")
}

// 測試完整的上傳流程
func TestUploadE2E(t *testing.T) {
	// 設置測試環境
	gin.SetMode(gin.TestMode)
	router := routes.SetupRouter(testConfig)
	ts := httptest.NewServer(router)
	defer ts.Close()

	// 建立測試檔案
	err := createTestFile()
	assert.NoError(t, err)
	defer cleanupTestFile()

	// 1. 開始分段上傳
	t.Run("Start Multipart Upload", func(t *testing.T) {
		log.Printf("Attempting to upload file: %s (size: %d MB)", testFileName, fileSize/1024/1024)
		resp, err := http.Post(fmt.Sprintf("%s/upload/start?key=%s", ts.URL, testFileName), "", nil)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		assert.NoError(t, err)
		assert.Contains(t, result, "uploadId")
		assert.Contains(t, result, "key")

		uploadID := result["uploadId"].(string)
		key := result["key"].(string)
		log.Printf("Upload started with key: %s and uploadId: %s", key, uploadID)

		// 讀取檔案
		file, err := os.Open(testFilePath)
		assert.NoError(t, err)
		defer file.Close()

		// 計算需要的分段數
		numParts := (fileSize + chunkSize - 1) / chunkSize
		completedParts := make([]types.CompletedPart, numParts)

		// 2. 分段上傳
		for partNumber := int32(1); partNumber <= int32(numParts); partNumber++ {
			t.Run(fmt.Sprintf("Upload Part %d", partNumber), func(t *testing.T) {
				log.Printf("Getting presigned URL for part %d/%d", partNumber, numParts)
				// 獲取預簽名 URL
				resp, err := http.Post(fmt.Sprintf("%s/upload/presign?key=%s&uploadId=%s&partNumber=%d",
					ts.URL, key, uploadID, partNumber), "", nil)
				assert.NoError(t, err)
				assert.Equal(t, http.StatusOK, resp.StatusCode)

				var presignResult map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&presignResult)
				assert.NoError(t, err)
				assert.Contains(t, presignResult, "presignUrl")

				presignURL := presignResult["presignUrl"].(string)

				// 準備分段數據
				buffer := make([]byte, chunkSize)
				n, err := file.Read(buffer)
				if err != nil && err != io.EOF {
					t.Fatal(err)
				}
				buffer = buffer[:n] // 調整到實際讀取的大小

				log.Printf("Uploading part %d/%d (size: %d bytes)", partNumber, numParts, n)
				// 上傳分段
				req, err := http.NewRequest("PUT", presignURL, bytes.NewReader(buffer))
				assert.NoError(t, err)
				req.Header.Set("Content-Type", "application/octet-stream")

				client := &http.Client{}
				resp, err = client.Do(req)
				assert.NoError(t, err)
				assert.Equal(t, http.StatusOK, resp.StatusCode)

				// 保存 ETag
				etag := resp.Header.Get("ETag")
				completedParts[partNumber-1] = types.CompletedPart{
					ETag:       &etag,
					PartNumber: &partNumber,
				}
				log.Printf("Successfully uploaded part %d/%d with ETag: %s", partNumber, numParts, etag)
			})
		}

		// 3. 完成上傳
		t.Run("Complete Upload", func(t *testing.T) {
			log.Printf("Completing multipart upload with %d parts", len(completedParts))
			completeBody := map[string]interface{}{
				"key":            key,
				"uploadId":       uploadID,
				"completedParts": completedParts,
			}

			jsonBody, err := json.Marshal(completeBody)
			assert.NoError(t, err)

			resp, err := http.Post(fmt.Sprintf("%s/upload/complete", ts.URL), "application/json", bytes.NewBuffer(jsonBody))
			assert.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			var completeResult map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&completeResult)
			assert.NoError(t, err)
			assert.Contains(t, completeResult, "message")
			log.Printf("Multipart upload completed successfully")
		})
	})
}

// 測試中止上傳
func TestAbortUpload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := routes.SetupRouter(testConfig)
	ts := httptest.NewServer(router)
	defer ts.Close()

	// 1. 開始分段上傳
	resp, err := http.Post(fmt.Sprintf("%s/upload/start?key=%s", ts.URL, testAbortFileName), "", nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	assert.NoError(t, err)
	uploadID := result["uploadId"].(string)
	key := result["key"].(string)

	// 2. 中止上傳
	abortBody := map[string]interface{}{
		"key":      key,
		"uploadId": uploadID,
	}

	jsonBody, err := json.Marshal(abortBody)
	assert.NoError(t, err)

	resp, err = http.Post(fmt.Sprintf("%s/upload/abort", ts.URL), "application/json", bytes.NewBuffer(jsonBody))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var abortResult map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&abortResult)
	assert.NoError(t, err)
	assert.Contains(t, abortResult, "message")
}
