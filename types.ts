export type LockType = "PIN" | "PASSWORD";
export interface VaultItem {
  id: string;
  parentId?: string;
  type: "FILE" | "FOLDER";
  originalName: string;
  originalPath: string;
  mimeType: string;
  size: number;
  importedAt: number;
}
export interface IntruderSession {
  id: string;
  timestamp: number;
  attempts: number;
  images: VaultItem[];
}
export interface IntruderSettings {
  enabled: boolean;
  photoCount: 1 | 2 | 3;
  source: "FRONT" | "BACK" | "BOTH";
}
export interface EncryptionPlugin {
  isInitialized(): Promise<{ initialized: boolean }>;
  initializeVault(options: {
    password: string;
    type: LockType;
  }): Promise<{ success: boolean }>;
  unlockVault(
    password: string
  ): Promise<{ success: boolean; mode: "REAL" | "DECOY" }>;
  lockVault(): Promise<void>;
  importFile(options: {
    fileBlob: Blob;
    fileName: string;
    password: string;
    parentId?: string;
  }): Promise<VaultItem>;
  createFolder(options: {
    name: string;
    parentId?: string;
  }): Promise<VaultItem>;
  moveItems(options: {
    itemIds: string[];
    targetParentId?: string;
  }): Promise<{ success: boolean }>;
  copyItems(options: {
    itemIds: string[];
    targetParentId?: string;
    password: string;
  }): Promise<{ success: boolean }>;
  getVaultFiles(): Promise<VaultItem[]>;
  deleteVaultFile(options: { id: string }): Promise<{ success: boolean }>;
  deleteVaultItems(options: { ids: string[] }): Promise<{ success: boolean }>;
  exportFile(options: {
    id: string;
    password: string;
  }): Promise<{ success: boolean; exportedPath: string }>;
  previewFile(options: {
    id: string;
    password: string;
  }): Promise<{ uri: string }>;
  // New Streaming Methods
  getFileChunk(options: {
    id: string;
    index: number;
  }): Promise<{ data: Uint8Array }>;
  getFileInfo(options: {
    id: string;
  }): Promise<{ totalChunks: number; size: number }>;
  
  getLockType(): Promise<{ type: LockType }>;
  updateCredentials(options: {
    oldPassword: string;
    newPassword: string;
    newType: LockType;
  }): Promise<{ success: boolean }>;
  checkBiometricAvailability(): Promise<{ available: boolean }>;
  getBiometricStatus(): Promise<{ enabled: boolean }>;
  setBiometricStatus(options: {
    enabled: boolean;
    password?: string;
  }): Promise<void>;
  authenticateBiometric(): Promise<{
    success: boolean;
    password?: string;
    error?: string;
  }>;
  resetVault(password: string): Promise<{ success: boolean }>;
  enablePrivacyScreen(options: { enabled: boolean }): Promise<void>;
  setDecoyCredential(options: {
    decoyPassword: string;
    masterPassword: string;
  }): Promise<{ success: boolean }>;
  removeDecoyCredential(password: string): Promise<{ success: boolean }>;
  hasDecoy(): Promise<{ hasDecoy: boolean }>;
  getIntruderSettings(): Promise<IntruderSettings>;
  setIntruderSettings(settings: IntruderSettings): Promise<void>;
  checkCameraPermission(): Promise<{ granted: boolean }>;
  captureIntruderEvidence(): Promise<void>;
  getIntruderLogs(): Promise<IntruderSession[]>;
  deleteIntruderSession(options: {
    timestamp: number;
  }): Promise<{ success: boolean }>;
}
export interface EncryptionResult {
  success: boolean;
  outputPath: string;
  stats?: {
    timeMs: number;
    fileSize: number;
  };
}
/** Categorizes files by type for optimal handling */
export type FileTypeCategory =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "PDF"
  | "TEXT"
  | "DOCUMENT"
  | "SPREADSHEET"
  | "ARCHIVE"
  | "APK"
  | "UNKNOWN";
/** Result of opening a file */
export interface FileOpenResult {
  /** true if file was successfully opened/previewed */
  success: boolean;
  /** Method used to open the file */
  method: "IN_APP" | "NATIVE" | "DOWNLOAD" | "UNSUPPORTED";
  /** URI/URL where file is accessible (null if external app opened it) */
  uri: string | null;
  /** Detected file category */
  category: FileTypeCategory;
  /** User-friendly error message if success=false */
  error?: string;
  /** Whether file was decrypted (for vault files) */
  wasDecrypted?: boolean;
  /** Path to temporary file (if created for vault decryption) */
  tempPath?: string;
}
/** File type detection result */
export interface FileTypeDetectionResult {
  /** Detected MIME type */
  mimeType: string;
  /** File category for handling logic */
  category: FileTypeCategory;
  /** Confidence of detection (0-1, where 1 is certain) */
  confidence: number;
  /** Why this detection was chosen */
  detectedBy: "EXTENSION" | "MAGIC_BYTES" | "MIME_TYPE";
  /** Extension without dot (e.g., 'pdf') */
  extension: string;
  /** Suggested opener method */
  suggestedMethod: "IN_APP" | "NATIVE" | "DOWNLOAD" | "UNSUPPORTED";
}
/** Progress tracking for large file streaming/processing */
export interface StreamProgress {
  /** Total bytes to process */
  total: number;
  /** Bytes processed so far */
  loaded: number;
  /** Percentage complete (0-100) */
  percent: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;
  /** Current speed in MB/s */
  speedMbps?: number;
}
/** Configuration for file opening behavior */
export interface FileOpenConfig {
  /** Max file size to load into memory (MB), larger files stream or use native opener */
  maxInMemorySize?: number;
  /** Enable thumbnail generation for list views */
  generateThumbnails?: boolean;
  /** Cache thumbnails securely */
  cacheThumbnails?: boolean;
  /** Max thumbnail cache size (MB) */
  maxCacheSize?: number;
  /** Temporary directory path for decrypted vault files (on native) */
  tempDir?: string;
  /** Enable secure wipe of temp files after opening */
  secureWipeTempFiles?: boolean;
  /** Timeout for file operations (ms) */
  operationTimeout?: number;
}
/** File metadata for list view display */
export interface FileMetadata {
  /** Original file name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Detected file category */
  category: FileTypeCategory;
  /** Base64-encoded thumbnail (if generated) */
  thumbnail?: string;
  /** Width of thumbnail */
  thumbnailWidth?: number;
  /** Height of thumbnail */
  thumbnailHeight?: number;
  /** Whether native opener is available for this type */
  canOpenNatively?: boolean;
  /** Whether in-app preview is available */
  canPreviewInApp?: boolean;
  /** Formatted file size string (e.g., "2.5 MB") */
  sizeFormatted?: string;
}