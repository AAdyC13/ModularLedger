/**
 * Runtime - 初始化和生命週期管理
 */

import { Router } from './router.js';
import { registerComponents } from './components.js';
import { createLogger } from './logger.js';
import bridge from './bridge.js';

class Runtime {
    constructor() {
        this.router = null;
        this.isInitialized = false;
        this.bridge = bridge;
        this.logger = createLogger('Runtime');


    }

    /**
     * 啟動應用（嚴格資源控制版本）
     */
    async start() {
        try {
            this.logger.info('Starting application');

            // 1. 檢查必要的 DOM 元素
            this.checkRequirements();

            // 2. 註冊全局組件（預載入所有組件 HTML）
            this.logger.info('Preloading components...');
            await registerComponents();

            // 3. 初始化路由器
            this.logger.info('Initializing router...');
            this.router = new Router();

            // 4. 注入全域組件引用到路由器
            const { components, createComponent, getComponent } = await import('./components.js');

            // 創建組件管理器代理
            const componentsManager = { createComponent, getComponent };

            // 註冊到路由器（傳遞所有已註冊的單例組件）
            this.router.registerGlobalComponents(components, componentsManager);

            // 5. 預載入所有頁面（HTML 和 JS 模組）
            this.logger.info('Preloading all pages...');
            await this.router.preloadAllPages();

            // 6. 載入首頁
            this.logger.info('Loading home page from cache...');
            await this.router.navigate('pages/home.html', { replace: true, skipAnimation: true });

            // 7. 標記為已初始化
            this.isInitialized = true;

            this.logger.info('Application started successfully!');

        } catch (error) {
            this.logger.error(`Application startup failed: ${error.message}`);

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
