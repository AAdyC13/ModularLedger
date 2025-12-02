/**
 * ErrorHandler - 系統級錯誤處理器
 * 負責捕獲和處理未捕獲的異常,提供系統兜底機制
 */

export class ErrorHandler {
    constructor(logger, eventBus, options = {}) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.isActive = false;
        this.errorCount = 0;
        this.errorHistory = [];
        this.maxHistorySize = 50;
        this.crashThreshold = 5; // 短時間內錯誤次數閾值
        this.crashTimeWindow = 10000; // 10秒內
        this.isCrashed = false;
        this.errorCallbacks = [];
    }

    /**
     * 初始化錯誤處理器
     */
    init() {
        try {
            if (this.isActive) {
                this.logger.warn('ErrorHandler already initialized');
                return;
            }
            // 捕獲未處理的 Promise rejection
            window.addEventListener('unhandledrejection', (event) => {
                this.handleError({
                    type: 'UnhandledPromiseRejection',
                    message: event.reason?.message || String(event.reason),
                    stack: event.reason?.stack,
                    timestamp: Date.now()
                });
                event.preventDefault();
            });

            // 捕獲全局錯誤
            window.addEventListener('error', (event) => {
                this.handleError({
                    type: 'GlobalError',
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack,
                    timestamp: Date.now()
                });
                event.preventDefault();
            });

            this.isActive = true;
            this.logger.info('ErrorHandler initialized');
        } catch (err) {
            this.logger.error(`ErrorHandler init failed: ${err}`);
            throw err;
        }
    }

    /**
     * 處理錯誤
     */
    handleError(error) {
        // 記錄錯誤
        this.errorCount++;
        this.errorHistory.push(error);

        // 維護歷史記錄大小
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }

        // 記錄日誌
        this.logger.error(`[${error.type}] ${error.message}`, {
            filename: error.filename,
            line: error.lineno,
            column: error.colno,
            stack: error.stack
        });

        // 檢查是否達到崩潰閾值
        if (this.shouldTriggerCrashProtection()) {
            this.triggerCrashProtection();
            return;
        }

        // 通知所有註冊的回調
        this.notifyErrorCallbacks(error);
    }

    /**
     * 判斷是否應該觸發崩潰保護
     */
    shouldTriggerCrashProtection() {
        if (this.isCrashed) return false;

        const now = Date.now();
        const recentErrors = this.errorHistory.filter(
            e => now - e.timestamp < this.crashTimeWindow
        );

        return recentErrors.length >= this.crashThreshold;
    }

    /**
     * 觸發崩潰保護機制
     */
    triggerCrashProtection() {
        if (this.isCrashed) return;

        this.isCrashed = true;
        this.logger.error('System crash detected! Triggering protection mode...');

        // 顯示崩潰畫面
        this.showCrashScreen();

        // 嘗試保存狀態
        this.saveErrorState();
    }

    /**
     * 顯示崩潰畫面
     */
    showCrashScreen() {
        const app = document.getElementById('app');
        if (!app) {
            this.logger.error('Cannot show crash screen: #app not found');
            return;
        }

        const errorSummary = this.getErrorSummary();

        app.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding: 2rem;
                text-align: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            ">
                <div style="
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 2rem;
                    max-width: 500px;
                    width: 100%;
                ">
                    <h1 style="margin: 0 0 1rem 0; font-size: 2rem;">⚠️ 系統崩潰</h1>
                    <p style="margin: 0 0 1.5rem 0; opacity: 0.9;">
                        應用程式遇到了嚴重錯誤,已自動啟用保護模式
                    </p>
                    
                    <div style="
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 12px;
                        padding: 1rem;
                        margin-bottom: 1.5rem;
                        text-align: left;
                        font-size: 0.9rem;
                    ">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>錯誤統計:</strong> ${errorSummary.totalErrors} 個錯誤
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <strong>最近錯誤:</strong> ${errorSummary.recentErrors} 個 (${this.crashTimeWindow / 1000}秒內)
                        </div>
                        <div style="
                            max-height: 100px;
                            overflow-y: auto;
                            font-family: monospace;
                            font-size: 0.8rem;
                            opacity: 0.8;
                        ">
                            ${errorSummary.lastError}
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button 
                            onclick="errorHandler.reloadApp()" 
                            style="
                                padding: 0.75rem 1.5rem;
                                border: none;
                                border-radius: 12px;
                                background: white;
                                color: #667eea;
                                cursor: pointer;
                                font-size: 16px;
                                font-weight: bold;
                            "
                        >
                            重新載入
                        </button>
                        <button 
                            onclick="errorHandler.clearAndReload()" 
                            style="
                                padding: 0.75rem 1.5rem;
                                border: 2px solid white;
                                border-radius: 12px;
                                background: transparent;
                                color: white;
                                cursor: pointer;
                                font-size: 16px;
                            "
                        >
                            清除數據並重新載入
                        </button>
                    </div>

                    <div style="margin-top: 1.5rem; font-size: 0.85rem; opacity: 0.7;">
                        錯誤報告已保存在本地存儲中
                    </div>
                </div>
            </div>
        `;

        // 將 errorHandler 暴露到全局,供按鈕調用
        window.errorHandler = this;
    }

    /**
     * 獲取錯誤摘要
     */
    getErrorSummary() {
        const now = Date.now();
        const recentErrors = this.errorHistory.filter(
            e => now - e.timestamp < this.crashTimeWindow
        );

        const lastError = this.errorHistory[this.errorHistory.length - 1];

        return {
            totalErrors: this.errorHistory.length,
            recentErrors: recentErrors.length,
            lastError: lastError ? `${lastError.type}: ${lastError.message}` : '無'
        };
    }

    /**
     * 保存錯誤狀態到本地存儲
     */
    saveErrorState() {
        try {
            const errorReport = {
                timestamp: Date.now(),
                crashCount: this.errorCount,
                errors: this.errorHistory.slice(-10), // 只保存最近10條
                userAgent: navigator.userAgent,
                url: window.location.href
            };

            localStorage.setItem('app_crash_report', JSON.stringify(errorReport));
            this.logger.info('Error state saved to localStorage');
        } catch (e) {
            this.logger.error('Failed to save error state: ' + e.message);
        }
    }

    /**
     * 重新載入應用
     */
    reloadApp() {
        this.logger.info('Reloading application...');
        window.location.reload();
    }

    /**
     * 清除數據並重新載入
     */
    clearAndReload() {
        this.logger.info('Clearing data and reloading...');
        try {
            // 保留錯誤報告
            const crashReport = localStorage.getItem('app_crash_report');
            localStorage.clear();
            sessionStorage.clear();
            if (crashReport) {
                localStorage.setItem('app_crash_report', crashReport);
            }
        } catch (e) {
            this.logger.error('Failed to clear storage: ' + e.message);
        }
        window.location.reload();
    }

    /**
     * 註冊錯誤回調
     */
    onError(callback) {
        if (typeof callback === 'function') {
            this.errorCallbacks.push(callback);
        }
    }

    /**
     * 通知所有錯誤回調
     */
    notifyErrorCallbacks(error) {
        this.errorCallbacks.forEach(callback => {
            try {
                callback(error);
            } catch (e) {
                this.logger.error('Error in error callback: ' + e.message);
            }
        });
    }

    /**
     * 獲取錯誤歷史
     */
    getErrorHistory() {
        return [...this.errorHistory];
    }

    /**
     * 清除錯誤歷史
     */
    clearErrorHistory() {
        this.errorHistory = [];
        this.errorCount = 0;
        this.isCrashed = false;
        this.logger.info('Error history cleared');
    }

    /**
     * 手動報告錯誤
     */
    reportError(message, details = {}) {
        this.handleError({
            type: 'ManualReport',
            message,
            ...details,
            timestamp: Date.now()
        });
    }

    /**
     * 檢查是否有之前的崩潰報告
     */
    checkPreviousCrash() {
        try {
            const report = localStorage.getItem('app_crash_report');
            if (report) {
                const crashData = JSON.parse(report);
                this.logger.warn('Previous crash detected:', crashData);
                return crashData;
            }
        } catch (e) {
            this.logger.error('Failed to check previous crash: ' + e.message);
        }
        return null;
    }

    /**
     * 清除崩潰報告
     */
    clearCrashReport() {
        try {
            localStorage.removeItem('app_crash_report');
            this.logger.info('Crash report cleared');
        } catch (e) {
            this.logger.error('Failed to clear crash report: ' + e.message);
        }
    }
}
