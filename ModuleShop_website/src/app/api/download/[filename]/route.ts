// app/api/download/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    // 等待 params 解析 (Next.js 16+ 規範)
    const { filename } = await params;
    const filePath = path.join(process.cwd(), 'public/uploads', filename);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=${filename}`,
        },
    });
}