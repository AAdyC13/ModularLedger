import { Package } from 'lucide-react';

export default function Header({ count }: { count: number }) {
  return (
    <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
          <Package className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Module Shop</h1>
          <p className="text-sm text-gray-500">Android 模組化套件管理中心</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium text-gray-600">
          已上架模組: <span className="text-gray-900 font-bold ml-1">{count}</span>
        </span>
      </div>
    </header>
  );
}