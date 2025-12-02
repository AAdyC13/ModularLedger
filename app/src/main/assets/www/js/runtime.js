/**
 * Runtime - 初始化和生命週期管理
 */

import { loggerManager, Logger } from './logger.js';
import runtimeConfig from './runtimeConfig.js';
import { eventHub } from './eventHub.js';
import { Bridge } from './bridge.js';

import { ErrorHandler } from './errorHandler.js';
import { ModulesManager } from './modulesManager.js';
import { PageManager } from './pageManager.js';
import { ElementManager } from './elementManager.js';
import { Router } from './router.js';

// import { ComponentManager } from './componentManager.js';




class Runtime {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * 啟動應用
     */
    async start() {
        try {

            // --------------------------------------------
            // 1. 基礎系統初始化 (同步)
            // --------------------------------------------
            loggerManager.setLevel(runtimeConfig.logLevel || 'DEBUG');

            this.logger = new Logger('Runtime');
            this.logger.info('Starting application');

            this.checkRequirements(); // 基礎環境檢查
            this.logger.debug('checkRequirements finished');

            eventHub.init(new Logger('EventHub'), new Logger('EventAgent')); // 全局事件總線
            eventHub.setReady();
            this.eventAgent = eventHub.createAgent('Runtime');
            const bridge = new Bridge(new Logger('Bridge')); // 與原生交互橋樑
            this.logger.debug('Basic tools build successfully');
            // --------------------------------------------
            // 2. 建立核心管理器實例（但不初始化）
            // --------------------------------------------


            const errorHandler = new ErrorHandler(
                new Logger('ErrorHandler'),
                eventHub.createAgent('ErrorHandler'),
            );
            this.logger.debug('ErrorHandler build successfully');

            const modulesManager = new ModulesManager(
                new Logger('ModulesManager'),
                bridge,
                eventHub.createAgent('ModulesManager'),
                runtimeConfig.whitelist || [],
            );
            this.logger.debug('ModulesManager build successfully');

            const pageManager = new PageManager(
                new Logger('PageManager'),
                bridge,
                eventHub.createAgent('PageManager'),
                runtimeConfig.layoutIDs || {}
            );
            this.logger.debug('PageManager build successfully');

            const elementManager = new ElementManager(
                new Logger('ElementManager'),
                eventHub.createAgent('ElementManager')
            );
            this.logger.debug('ElementManager build successfully');

            const router = new Router(
                new Logger('Router'),
                eventHub.createAgent('Router'),
            );
            this.logger.debug('Router build successfully');

            // const componentManager = new ComponentManager({
            //     logger: new Logger('ComponentManager'),
            //     eventHub,
            // });

            // --------------------------------------------
            // 3. 並行初始化可 async import 的管理器
            // --------------------------------------------
            await Promise.all([
                errorHandler.init(),
                modulesManager.init(new Logger('Module')),
                pageManager.init(runtimeConfig.preLoadPages || []),
                elementManager.init(),
                router.init(),
            ]);
            this.logger.debug('All System initialized');


            // --------------------------------------------
            // x. 啟動頁面渲染
            // --------------------------------------------
            if (!runtimeConfig.indexPage) {
                throw new Error('indexPage is not defined in runtimeConfig');
            }
            //this.eventAgent.emit('Index_page_is', runtimeConfig.indexPage, {});
            router.indexPageIs(runtimeConfig.indexPage);

            modulesManager.enableSystemModules();

            


            // --------------------------------------------
            // x. finished
            // --------------------------------------------
            window.errorHandler = errorHandler; // 供崩潰畫面使用
            await router.start();
            this.isInitialized = true;
            this.logger.info('Application started successfully');

        } catch (error) {
            if (this.logger) {
                this.logger.error(`Application startup failed: ${error}`);
            }
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
