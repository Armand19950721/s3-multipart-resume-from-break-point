import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UploadPart {
  ETag: string;
  PartNumber: number;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

interface UploadState {
  fileInfo: FileInfo | null;
  uploadProgress: number;
  uploadedParts: UploadPart[];
  uploadId: string | null;
  isUploading: boolean;
  error: string | null;
}

const initialState: UploadState = {
  fileInfo: null,
  uploadProgress: 0,
  uploadedParts: [],
  uploadId: null,
  isUploading: false,
  error: null,
};

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    setFile: (state, action: PayloadAction<FileInfo>) => {
      state.fileInfo = action.payload;
      state.error = null;
    },
    setUploadId: (state, action: PayloadAction<string>) => {
      state.uploadId = action.payload;
    },
    addUploadedPart: (state, action: PayloadAction<UploadPart>) => {
      state.uploadedParts.push(action.payload);
    },
    updateProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    setIsUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
      if (action.payload === false) {
        state.uploadProgress = 0;
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload !== null) {
        state.isUploading = false;
        state.uploadProgress = 0;
      }
    },
    resetUpload: (state) => {
      return {
        ...initialState,
        fileInfo: state.fileInfo, // 保留當前文件信息
      };
    },
  },
});

export const {
  setFile,
  setUploadId,
  addUploadedPart,
  updateProgress,
  setIsUploading,
  setError,
  resetUpload,
} = uploadSlice.actions;

export default uploadSlice.reducer; 