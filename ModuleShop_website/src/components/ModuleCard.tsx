import { Download, Calendar, User, Tag, HardDrive } from 'lucide-react';
import { ModuleRecord } from '@/types/module';

export default function ModuleCard({ module }: { module: ModuleRecord }) {
  // 格式化檔案大小
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full group">
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              {module.name}
            </h3>
            <span className="text-xs font-mono text-gray-400 mt-1">{module.id}</span>
          </div>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md border border-blue-100">
            v{module.version}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 line-clamp-3 mb-4 min-h-[3em]">
          {module.description || '暫無描述'}
        </p>

        <div className="flex flex-wrap gap-2">
          {module.tags && module.tags.map(tag => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex justify-between items-center">
        <div className="flex flex-col gap-1 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {module.author}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(module.uploadDate).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            {formatSize(module.size)}
          </div>
        </div>

        <a 
          href={module.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 shadow-sm"
        >
          <Download className="w-4 h-4" />
          下載
        </a>
      </div>
    </div>
  );
}