import { useState, useCallback, useRef } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { FileUploader } from './components/FileUploader';
import { useDispatch, useSelector } from 'react-redux';
import { setFile, setError, setIsUploading, updateProgress, setUploadId, addUploadedPart, resetUpload } from './store/uploadSlice';
import type { RootState } from './store';
import axios from 'axios';
import { Box, Container, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const API_BASE_URL = 'http://localhost:8080';

interface UploadPart {
  ETag: string;
  PartNumber: number;
}

function UploadContainer() {
  const dispatch = useDispatch();
  const [isDragging, setIsDragging] = useState(false);
  const currentFileRef = useRef<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { fileInfo, uploadProgress, isUploading, error, uploadId } = useSelector((state: RootState) => state.upload);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      currentFileRef.current = droppedFile;
      dispatch(setFile({
        name: droppedFile.name,
        size: droppedFile.size,
        type: droppedFile.type
      }));
    }
  }, [dispatch]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      currentFileRef.current = selectedFile;
      dispatch(setFile({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      }));
    }
  };

  const startMultipartUpload = async (fileName: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/upload/start?key=${encodeURIComponent(fileName)}`);
      if (!response.data.uploadId) {
        throw new Error('No upload ID received');
      }
      return response.data.uploadId;
    } catch (error) {
      console.error('Start upload error:', error);
      throw new Error('Failed to start multipart upload');
    }
  };

  const getPresignedUrl = async (
    uploadId: string,
    partNumber: number,
    fileName: string
  ) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/upload/presign?key=${encodeURIComponent(fileName)}&uploadId=${uploadId}&partNumber=${partNumber}`
      );
      if (!response.data.presignUrl) {
        throw new Error('No presigned URL received');
      }
      return response.data.presignUrl;
    } catch (error) {
      console.error('Get presigned URL error:', error);
      throw new Error(`Failed to get presigned URL for part ${partNumber}`);
    }
  };

  const uploadPart = async (
    presignedUrl: string,
    partNumber: number,
    chunk: Blob
  ): Promise<UploadPart> => {
    try {
      console.log(`Uploading part ${partNumber} to URL:`, presignedUrl);
      console.log(`Chunk size: ${chunk.size} bytes`);

      const uploadPromise = new Promise<UploadPart>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            const etag = xhr.getResponseHeader('etag') || 
                        xhr.getResponseHeader('ETag') || 
                        xhr.getResponseHeader('x-amz-etag');
            
            console.log('Response headers:', {
              etag: xhr.getResponseHeader('etag'),
              'x-amz-etag': xhr.getResponseHeader('x-amz-etag'),
              'all-headers': xhr.getAllResponseHeaders()
            });

            if (etag) {
              resolve({
                ETag: etag,
                PartNumber: partNumber
              });
            } else {
              reject(new Error(`No ETag in response for part ${partNumber}`));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Upload failed'));
        };

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            console.log(`Part ${partNumber} progress: ${percentComplete.toFixed(2)}%`);
          }
        };

        xhr.send(chunk);
      });

      const result = await uploadPromise;
      console.log(`Successfully uploaded part ${partNumber} with ETag:`, result.ETag);
      return result;
    } catch (error) {
      console.error(`Error uploading part ${partNumber}:`, error);
      throw error;
    }
  };

  const completeMultipartUpload = async (
    uploadId: string,
    parts: UploadPart[],
    fileName: string
  ) => {
    try {
      const invalidParts = parts.filter(part => !part.ETag);
      if (invalidParts.length > 0) {
        throw new Error(`Missing ETag for parts: ${invalidParts.map(p => p.PartNumber).join(', ')}`);
      }

      const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
      
      const formattedParts = sortedParts.map(part => ({
        ...part,
        ETag: part.ETag.startsWith('"') ? part.ETag : `"${part.ETag}"`
      }));
      
      const payload = {
        key: fileName,
        uploadId: uploadId,
        completedParts: formattedParts
      };
      
      console.log('Complete upload payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(`${API_BASE_URL}/upload/complete`, payload);
      console.log('Complete upload response:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Complete upload error:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Failed to complete multipart upload: ${errorMessage}`);
      }
      throw error;
    }
  };

  const abortMultipartUpload = async (uploadId: string, fileName: string) => {
    try {
      await axios.post(`${API_BASE_URL}/upload/abort`, {
        key: fileName,
        uploadId: uploadId,
      });
    } catch (error) {
      console.error('Abort upload error:', error);
    }
  };

  const handleUpload = async () => {
    const file = currentFileRef.current;
    if (!file || !fileInfo) return;

    dispatch(setIsUploading(true));
    dispatch(resetUpload());
    abortControllerRef.current = new AbortController();

    try {
      // 1. Start multipart upload
      const newUploadId = await startMultipartUpload(fileInfo.name);
      dispatch(setUploadId(newUploadId));

      // 2. Calculate parts
      const chunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadedParts: UploadPart[] = [];

      // 3. Upload each part
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;

        // Get presigned URL for this part
        const presignedUrl = await getPresignedUrl(newUploadId, partNumber, fileInfo.name);
        
        // Upload the part
        const part = await uploadPart(presignedUrl, partNumber, chunk);
        uploadedParts.push(part);
        dispatch(addUploadedPart(part));

        const progress = Math.round(((i + 1) / chunks) * 100);
        dispatch(updateProgress(progress));
      }

      // 4. Complete multipart upload
      await completeMultipartUpload(newUploadId, uploadedParts, fileInfo.name);
      dispatch(setIsUploading(false));
      dispatch(setError(null));
    } catch (err) {
      if (err instanceof Error) {
        dispatch(setError(err.message));
        if (uploadId && fileInfo) {
          await abortMultipartUpload(uploadId, fileInfo.name);
        }
      } else {
        dispatch(setError('Upload failed'));
      }
      dispatch(setIsUploading(false));
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = async () => {
    if (uploadId && fileInfo) {
      abortControllerRef.current?.abort();
      await abortMultipartUpload(uploadId, fileInfo.name);
      dispatch(resetUpload());
    }
  };

  return (
    <FileUploader
      handleDrop={handleDrop}
      handleDragOver={handleDragOver}
      handleDragLeave={handleDragLeave}
      handleFileSelect={handleFileSelect}
      handleUpload={handleUpload}
      handleCancel={handleCancel}
      fileInfo={fileInfo}
      isDragging={isDragging}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      error={error}
    />
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <Box
          sx={{
            minHeight: '100vh',
            py: 8,
            px: 2,
            bgcolor: 'background.default'
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography variant="h2" component="h1" gutterBottom>
                S3 文件上傳
              </Typography>
              <Typography variant="h6" color="text.secondary">
                支持大文件分片上傳，可暫停續傳
              </Typography>
            </Box>
            <UploadContainer />
          </Container>
        </Box>
      </Provider>
    </ThemeProvider>
  );
}

export default App;
