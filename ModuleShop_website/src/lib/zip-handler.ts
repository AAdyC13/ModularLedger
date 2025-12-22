// src/lib/zip-handler.ts
import AdmZip from 'adm-zip';
import { ModuleInfo } from '@/types/module';

export const parseModuleZip = async (buffer: Buffer): Promise<ModuleInfo> => {
  const zip = new AdmZip(buffer);
  
  // 直接獲取根目錄下的 info.json，若檔案在資料夾內則會回傳 null
  const infoEntry = zip.getEntry('info.json');

  if (!infoEntry || infoEntry.isDirectory) {
    throw new Error('壓縮檔根目錄未找到有效的 info.json');
  }

  let infoJson: ModuleInfo;
  
  try {
    const content = infoEntry.getData().toString('utf8');
    infoJson = JSON.parse(content) as ModuleInfo;
  } catch (e) {
    console.error("JSON parse error in zip", e);
    throw new Error('info.json 解析失敗，請確認格式正確');
  }

  if (!infoJson || !infoJson.id || !infoJson.version) {
    throw new Error('info.json 格式錯誤：內容為空或缺少 id 或 version 欄位');
  }

  return infoJson;
};