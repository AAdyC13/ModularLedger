// src/lib/zip-handler.ts
import AdmZip from 'adm-zip';
import { ModuleInfo } from '@/types/module';

export const parseModuleZip = async (buffer: Buffer): Promise<ModuleInfo> => {
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  let infoJson: ModuleInfo | null = null;

  // 遍歷 Zip 內容尋找 info.json
  for (const entry of zipEntries) {
    // 忽略 macOS 系統產生的隱藏資料夾，並尋找 info.json
    if (entry.entryName.endsWith('info.json') && !entry.entryName.includes('__MACOSX')) {
      try {
        const content = entry.getData().toString('utf8');
        infoJson = JSON.parse(content);
        break; // 找到就停止
      } catch (e) {
        console.error("JSON parse error in zip", e);
      }
    }
  }

  if (!infoJson) {
    throw new Error('壓縮檔內未找到有效的 info.json');
  }

  // 基本驗證
  if (!infoJson.id || !infoJson.version) {
    throw new Error('info.json 格式錯誤：缺少 id 或 version 欄位');
  }

  return infoJson;
};