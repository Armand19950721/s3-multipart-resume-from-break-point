import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { resetUpload } from '../store/uploadSlice';
import { Box, Paper, Typography, Button, LinearProgress, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

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

// Styled Components
const StyledDropZone = styled(Paper)(({ theme }) => ({
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

const FilePreviewContainer = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
}));

const FileInfoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 2,
});

const FileIconWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  backgroundColor: theme.palette.primary.light,
  borderRadius: theme.shape.borderRadius,
}));

const ErrorMessage = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.error.light,
}));

// Sub-components
const UploadIcon = () => (
  <CloudUploadIcon
    sx={{
      fontSize: 48,
      color: 'primary.main',
      mb: 2,
    }}
  />
);

const FilePreview = ({ fileInfo, isUploading, onRemove }: { 
  fileInfo: FileInfo; 
  isUploading: boolean; 
  onRemove: () => void;
}) => (
  <FilePreviewContainer>
    <FileInfoContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <FileIconWrapper>
          <InsertDriveFileIcon sx={{ color: 'primary.main' }} />
        </FileIconWrapper>
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
          onClick={onRemove}
          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
        >
          <CloseIcon />
        </IconButton>
      )}
    </FileInfoContainer>
  </FilePreviewContainer>
);

const UploadProgress = ({ progress, onCancel }: { 
  progress: number; 
  onCancel: () => void;
}) => (
  <Box sx={{ mt: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="body2" color="primary">
        正在上傳 {progress}%
      </Typography>
    </Box>
    <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
    <Button
      fullWidth
      variant="outlined"
      color="error"
      onClick={onCancel}
      startIcon={<CloseIcon />}
    >
      取消上傳
    </Button>
  </Box>
);

const ErrorDisplay = ({ error }: { error: string }) => (
  <ErrorMessage>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <CloseIcon sx={{ color: 'error.main', fontSize: 20 }} />
      <Typography variant="body2" color="error.main">
        {error}
      </Typography>
    </Box>
  </ErrorMessage>
);

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
      <StyledDropZone
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
          <UploadIcon />
          
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
      </StyledDropZone>

      {fileInfo && (
        <FilePreview
          fileInfo={fileInfo}
          isUploading={isUploading}
          onRemove={() => dispatch(resetUpload())}
        />
      )}

      {isUploading && (
        <UploadProgress
          progress={uploadProgress}
          onCancel={handleCancel}
        />
      )}

      {!isUploading && fileInfo && (
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

      {error && <ErrorDisplay error={error} />}
    </Box>
  );
}; 