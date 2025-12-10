// src/types/module.ts

export interface ModuleInfo {
  id: string;          // 例如: "system.HomePage"
  name: string;        // 例如: "Home Page builder"
  version: string;     // 例如: "1.0.0"
  author: string;      // 例如: "admin"
  description?: string;
  "module license"?: string;
  tags?: string[];
}

// 擴充欄位，用於後端儲存檔案資訊
export interface ModuleRecord extends ModuleInfo {
  fileName: string;    // 實際儲存的 zip 檔名
  downloadUrl: string; // 下載連結
  uploadDate: string;  // 上傳時間
  size: number;        // 檔案大小 (bytes)
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}