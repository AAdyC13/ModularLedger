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
import { ComponentManager } from './componentManager.js';
import { uiManager } from './uiManager.js';

class Runtime {
    constructor() {
        this.isInitialized = false;
        this.indexPageLoaded = false;
        this.bridge = null; // 確保有定義 bridge 屬性
    }

    /**
     * 啟動應用
     */
    async start() {
        const loggerContainer = document.getElementById('sys_loading_page_logger');
        if (loggerContainer) {
            loggerManager.addLogListener((type, message) => {
                const logEntry = document.createElement('div');
                logEntry.textContent = message;
                logEntry.classList.add(`log-${type.toLowerCase()}`);
                loggerContainer.appendChild(logEntry);

                // 只保留最新的 100 條日誌
                while (loggerContainer.children.length > 100) {
                    loggerContainer.firstChild.remove();
                }

                loggerContainer.scrollTop = loggerContainer.scrollHeight;
            });
        }
        try {

            // --------------------------------------------
            // 1. 基礎系統初始化
            // --------------------------------------------
            loggerManager.setLevel(runtimeConfig.logLevel || 'DEBUG');

            this.logger = new Logger('Runtime');
            this.logger.info('Starting application');

            this.checkRequirements(); // 基礎環境檢查
            this.logger.debug('checkRequirements finished');

            eventHub.init(new Logger('EventHub'), new Logger('EventAgent')); // 全局事件總線
            eventHub.setReady();
            this.eventAgent = eventHub.createAgent('Runtime');

            uiManager.init(new Logger('UIManager'), this.eventAgent); // UI 管理器
            this.ui = uiManager.createAgent('Runtime');
            loggerManager.setUiAgent(uiManager.createAgent('Logger')); // 傳遞 UI 代理給 LoggerManager

            // [修正點 1] 優先初始化 Bridge，確保後續 Manager 可以使用
            this.bridge = new Bridge(new Logger('Bridge')); 
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
                this.bridge, // 傳入 bridge
                eventHub.createAgent('ModulesManager'),
                runtimeConfig.whitelist || [],
                runtimeConfig.moduleLoadTimeout_s || 20
            );
            this.logger.debug('ModulesManager build successfully');

            const pageManager = new PageManager(
                new Logger('PageManager'),
                this.bridge, // 傳入 bridge
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

            const componentManager = new ComponentManager(
                new Logger('ComponentManager'),
                eventHub.createAgent('ComponentManager'),
                this.bridge, // 傳入 bridge
                uiManager.createAgent('ComponentManager')
            );
            this.logger.debug('ComponentManager build successfully');

            this.logger.debug('All system object build successfully');
            // --------------------------------------------
            // 3. 並行初始化可 async import 的管理器
            // --------------------------------------------
            try {
                await Promise.all([
                    errorHandler.init(),
                    modulesManager.init(new Logger('Module')),
                    pageManager.init(new Logger('Page')),
                    elementManager.init(new Logger('Element')),
                    router.init(),
                    componentManager.init(), 
                ]);
            } catch (initError) {
                this.logger.error(`System initialization error: ${initError}`);
                throw Error('System initialization failed');
            }
            this.logger.debug('All System initialized');


            // --------------------------------------------
            // x. 啟動頁面渲染
            // --------------------------------------------
            if (!runtimeConfig.indexPage) {
                throw new Error('indexPage is not defined in runtimeConfig');
            }

            // 設定監聽器：當 PageManager 載入完首頁時觸發
            await this.eventAgent.emit('RT:Index_page_is', runtimeConfig.indexPage, {});
            this.eventAgent.on('PM:Finish_preloade_page', (PE) => {
                if (PE.id === runtimeConfig.indexPage) {
                    this.indexPageLoaded = true;
                }
            });

            // 開始載入系統模組
            await modulesManager.enableSystemModules();

            // [修正點 2] 關鍵：等待首頁載入完成後才啟動 Router
            // 使用 monitorModuleLoading 輪詢 this.indexPageLoaded 狀態
            const isLoaded = await this.monitorModuleLoading(runtimeConfig.moduleLoadTimeout_s || 20);
            
            if (!isLoaded) {
                this.logger.warn(`Timeout waiting for index page [${runtimeConfig.indexPage}] to load. Proceeding anyway...`);
            } else {
                this.logger.info(`Index page [${runtimeConfig.indexPage}] ready.`);
            }

            // --------------------------------------------
            // x. finished
            // --------------------------------------------
            window.errorHandler = errorHandler; 

            if (runtimeConfig.logLevel === 'debug') {
                window.UIAgent = uiManager.createAgent('DebugConsole');
                this.logger.info('UI Agent for debug console is available at "window.UIAgent"');
            }

            // 確認頁面準備好後，才啟動路由導航
            await router.start();
            
            const loadingPage = document.getElementById('sys_loading_page');
            if (loadingPage) {
                loadingPage.classList.add('hidden');
            }
            this.isInitialized = true;
            this.logger.info('Application started successfully');

        } catch (error) {
            if (this.logger) {
                this.logger.error(`Application startup failed: ${error}`);
            }
            const loadingPage = document.getElementById('sys_loading_page');
            if (loadingPage) {
                loadingPage.classList.add('hidden');
            }
            this.handleStartupError(error);
        }
    }

    async monitorModuleLoading(timeout_s = 20) {
        const checkInterval = 50; // 毫秒
        const timeout = timeout_s * 1000;
        let elapsed = 0;

        return new Promise((resolve, reject) => {
            // 立即檢查一次
            if (this.indexPageLoaded) {
                resolve(true);
                return;
            }

            const intervalId = setInterval(() => {
                if (this.indexPageLoaded) {
                    clearInterval(intervalId);
                    resolve(true);
                }

                elapsed += checkInterval;
                if (elapsed >= timeout) {
                    clearInterval(intervalId);
                    resolve(false); // 超時
                }
            }, checkInterval);
        });
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