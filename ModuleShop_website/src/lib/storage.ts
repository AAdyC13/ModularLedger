// src/lib/storage.ts
import fs from 'fs';
import path from 'path';
import { ModuleRecord } from '@/types/module';

const DB_PATH = path.join(process.cwd(), 'data/modules.json');
const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');

// 初始化：確保目錄存在
const initDirs = () => {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

// 讀取所有模組
export const getModules = (): ModuleRecord[] => {
  initDirs();
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Read DB error:', error);
    return [];
  }
};

// 儲存模組記錄
export const saveModuleRecord = (newModule: ModuleRecord) => {
  initDirs();
  const modules = getModules();
  
  // 移除舊版本 (若 id 相同則覆蓋)
  const filtered = modules.filter(m => m.id !== newModule.id);
  filtered.push(newModule);
  
  // 依上傳時間排序 (最新的在前面)
  filtered.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  
  fs.writeFileSync(DB_PATH, JSON.stringify(filtered, null, 2));
};

// 獲取上傳目錄路徑
export const getUploadPath = () => UPLOAD_DIR;