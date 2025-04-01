import { useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setFile, setError, setIsUploading, updateProgress, setUploadId, addUploadedPart, resetUpload } from '../store/uploadSlice';
import type { RootState } from '../store';
import axios from 'axios';
import { Box, Paper, Typography, Button, LinearProgress, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const API_BASE_URL = 'http://localhost:8080';

interface UploadPart {
  ETag: string;
  PartNumber: number;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

interface FileUploaderProps {
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => void;
  handleCancel: () => void;
  fileInfo: FileInfo | null;
  isDragging: boolean;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

const DropZone = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  border: `2px dashed ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  cursor: 'pointer',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

export const FileUploader: React.FC<FileUploaderProps> = ({
  handleDrop,
  handleDragOver,
  handleDragLeave,
  handleFileSelect,
  handleUpload,
  handleCancel,
  fileInfo,
  isDragging,
  isUploading,
  uploadProgress,
  error,
}) => {
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ width: '100%' }}>
      <DropZone
        elevation={0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging ? 'action.hover' : 'background.default',
          opacity: isUploading ? 0.7 : 1,
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <Box sx={{ textAlign: 'center' }}>
          <CloudUploadIcon
            sx={{
              fontSize: 48,
              color: 'primary.main',
              mb: 2,
            }}
          />
          
          <Button
            variant="contained"
            onClick={handleClick}
            sx={{ mb: 1 }}
          >
            瀏覽文件
          </Button>
          
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            或將檔案拖放至此處
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            支持所有文件類型 · 單個文件最大 5GB
          </Typography>
        </Box>
      </DropZone>

      {fileInfo && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isUploading ? 2 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <Box sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 1 }}>
                <InsertDriveFileIcon sx={{ color: 'primary.main' }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {fileInfo.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(fileInfo.size / (1024 * 1024)).toFixed(2)} MB
                </Typography>
              </Box>
            </Box>
            {!isUploading && (
              <IconButton
                size="small"
                onClick={() => dispatch(resetUpload())}
                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
              >
                <CloseIcon />
              </IconButton>
            )}
          </Box>

          {isUploading && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="primary">
                  正在上傳 {uploadProgress}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 2 }} />
              <Button
                fullWidth
                variant="outlined"
                color="error"
                onClick={handleCancel}
                startIcon={<CloseIcon />}
              >
                取消上傳
              </Button>
            </Box>
          )}

          {!isUploading && (
            <Button
              fullWidth
              variant="contained"
              onClick={handleUpload}
              startIcon={<CloudUploadIcon />}
              sx={{ mt: 2 }}
            >
              開始上傳
            </Button>
          )}
        </Paper>
      )}

      {error && (
        <Paper sx={{ mt: 2, p: 2, bgcolor: 'error.light' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <CloseIcon sx={{ color: 'error.main', fontSize: 20 }} />
            <Typography variant="body2" color="error.main">
              {error}
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}; 