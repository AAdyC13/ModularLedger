'use client';
import { useState } from 'react';
import { UploadCloud, Loader2, FileCheck, AlertCircle } from 'lucide-react';
import { ApiResponse, ModuleRecord } from '@/types/module';

interface Props {
  onSuccess: () => void;
}

export default function UploadZone({ onSuccess }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/modules', { method: 'POST', body: formData });
      const json: ApiResponse<ModuleRecord> = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: `上傳成功: ${json.data?.name} v${json.data?.version}` });
        onSuccess();
      } else {
        setMessage({ type: 'error', text: json.message || '上傳失敗' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '網絡連線錯誤' });
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mb-10">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          relative group cursor-pointer
          border-2 border-dashed rounded-2xl p-8
          transition-all duration-200 ease-in-out
          flex flex-col items-center justify-center text-center
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 scale-[1.01]' 
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".zip"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          disabled={isUploading}
        />

        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
          ${isUploading ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-100'}
        `}>
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          ) : (
            <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'}`} />
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {isUploading ? '正在分析並上架...' : '拖曳或點擊上傳模組包'}
        </h3>
        <p className="text-sm text-gray-500 max-w-sm">
          僅支援 .zip 格式。系統將自動讀取壓縮檔內的 info.json 進行版本控管與上架。
        </p>

        {message && (
          <div className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 animate-pulse ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.type === 'success' ? <FileCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}