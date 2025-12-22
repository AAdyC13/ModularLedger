// src/app/api/modules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { parseModuleZip } from '@/lib/zip-handler';
import { getModules, saveModuleRecord, getUploadPath } from '@/lib/storage';
import { ApiResponse, ModuleRecord } from '@/types/module';

// 定義 CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 處理 Preflight (OPTIONS) 請求 - 這是修正 CORS 的關鍵
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: 獲取列表
export async function GET() {
  const modules = getModules();
  return NextResponse.json({ 
    success: true, 
    data: modules 
  }, {
    headers: corsHeaders // 確保 GET 回應也包含 Header
  });
}

// POST: 上傳檔案
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || !file.name.endsWith('.zip')) {
      return NextResponse.json(
        { success: false, message: '請上傳 .zip 格式的檔案' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. 解析 Zip (僅檢查根目錄 info.json)
    const info = await parseModuleZip(buffer);
    const safeId = info.id.replace(/[^a-zA-Z0-9.-]/g, '_');

    const safeFileName = `${safeId}_v${info.version}.zip`;
    const savePath = path.join(getUploadPath(), safeFileName);
    
    await writeFile(savePath, buffer);

    // 獲取 Host
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const absoluteDownloadUrl = `${baseUrl}/api/download/${safeFileName}`;

    const newRecord: ModuleRecord = {
      ...info,
      fileName: safeFileName,
      downloadUrl: absoluteDownloadUrl,
      uploadDate: new Date().toISOString(),
      size: file.size,
    };
    saveModuleRecord(newRecord);

    return NextResponse.json<ApiResponse<ModuleRecord>>({ 
      success: true, 
      data: newRecord,
      message: '模組上架成功'
    }, { 
      headers: corsHeaders 
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: error.message || '伺服器內部錯誤' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}