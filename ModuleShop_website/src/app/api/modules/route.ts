// src/app/api/modules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { parseModuleZip } from '@/lib/zip-handler';
import { getModules, saveModuleRecord, getUploadPath } from '@/lib/storage';
import { ApiResponse, ModuleRecord } from '@/types/module';

// GET: 獲取列表
export async function GET() {
  const modules = getModules();
  return NextResponse.json<ApiResponse<ModuleRecord[]>>({ 
    success: true, 
    data: modules 
  });
}

// POST: 上傳檔案
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || !file.name.endsWith('.zip')) {
      return NextResponse.json({ success: false, message: '請上傳 .zip 格式的檔案' }, { status: 400 });
    }

    // 將 File 轉為 Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. 解析 Zip 並驗證內容並
    const info = await parseModuleZip(buffer);
    const safeId = info.id.replace(/[^a-zA-Z0-9.-]/g, '_');;

    // 2. 決定儲存檔名 (使用 id_version.zip 格式避免檔名衝突)
    const safeFileName = `${safeId}_v${info.version}.zip`;
    const savePath = path.join(getUploadPath(), safeFileName);
    
    // 3. 寫入實體檔案
    await writeFile(savePath, buffer);

    // 4. 更新資料庫
    const newRecord: ModuleRecord = {
      ...info,
      fileName: safeFileName,
      downloadUrl: `/api/download/${safeFileName}`,
      uploadDate: new Date().toISOString(),
      size: file.size,
    };
    saveModuleRecord(newRecord);

    return NextResponse.json<ApiResponse<ModuleRecord>>({ 
      success: true, 
      data: newRecord,
      message: '模組上架成功'
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, message: error.message || '伺服器內部錯誤' }, { status: 500 });
  }
}