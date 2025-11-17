/**
 * Runtime - 應用運行時
 * 處理應用的初始化和生命週期管理
 */

import { Router } from './router.js';
import { registerComponents } from './components.js';

class Runtime {
    constructor() {
        this.router = null;
        this.isInitialized = false;
    }

    /**
     * 啟動應用
     */
    async start() {
        try {
            console.log('🚀 Starting application...');

            // 1. 檢查必要的 DOM 元素
            this.checkRequirements();

            // 2. 註冊全局組件
            console.log('📦 Registering components...');
            await registerComponents();

            // 3. 初始化路由器
            console.log('🗺️ Initializing router...');
            this.router = new Router();

            // 4. 載入首頁
            console.log('🏠 Loading home page...');
            await this.router.navigate('pages/home.html', { replace: true });

            // 5. 標記為已初始化
            this.isInitialized = true;

            console.log('✅ Application started successfully!');

        } catch (error) {
            console.error('❌ Application startup failed:', error);
            this.handleStartupError(error);
        }
    }

    /**
     * 檢查必要條件
     */
    checkRequirements() {
        const app = document.getElementById('app');
        if (!app) {
            throw new Error('App container (#app) not found');
        }
    }

    /**
     * 處理啟動錯誤
     */
    handleStartupError(error) {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 2rem;
                    text-align: center;
                    color: var(--text-primary);
                ">
                    <h2>應用啟動失敗</h2>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">
                        ${error.message}
                    </p>
                    <button 
                        onclick="location.reload()" 
                        style="
                            padding: 0.75rem 1.5rem;
                            border: none;
                            border-radius: 12px;
                            background: var(--color-lavender);
                            color: var(--text-primary);
                            cursor: pointer;
                            font-size: 16px;
                        "
                    >
                        重新載入
                    </button>
                </div>
            `;
        }
    }

    /**
     * 獲取路由器實例
     */
    getRouter() {
        return this.router;
    }
}

// 創建全局 runtime 實例
const runtime = new Runtime();

// 當 DOM 載入完成時啟動應用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        runtime.start();
    });
} else {
    // DOM 已經載入完成
    runtime.start();
}

// 導出 runtime 實例供其他模組使用
export default runtime;
