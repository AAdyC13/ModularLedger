'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import UploadZone from '@/components/UploadZone';
import ModuleCard from '@/components/ModuleCard';
import { ModuleRecord } from '@/types/module';

export default function Home() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 獲取模組列表函數
  const fetchModules = async () => {
    try {
      const res = await fetch('/api/modules');
      const json = await res.json();
      if (json.success) {
        setModules(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    fetchModules();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Header count={modules.length} />
        
        {/* 上傳區塊：上傳成功後重新獲取列表 */}
        <UploadZone onSuccess={fetchModules} />

        {/* 模組列表區塊 */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">最新上架</h2>
          
          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中...</div>
          ) : modules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
              目前沒有模組，請試著上傳第一個模組！
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}