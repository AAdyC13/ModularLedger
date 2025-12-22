/**
 * Android Bridge - 混合式架構通訊層
 * 包含：
 * 1. 同步調用 (Legacy/Fast operations)
 * 2. 異步任務匯流排 (Database/Heavy operations)
 */

// 全域接收器，供 Android 原生層調用
window.BridgeMessenger = {
    onNativeMessage: function (response) {
        // 這是空函數，Bridge 實例化時會接管此函數
        console.warn('BridgeMessenger not initialized yet.');
    }
};

export class Bridge {
    constructor(logger) {
        this.isAndroid = this.detectAndroid();
        this.logger = logger;
        this.virtual_domain = "https://appassets.androidplatform.net";

        // --- 異步任務系統 ---
        this.pendingTasks = new Map(); // { taskId: { resolve, reject, timer } }
        this.setupMessenger();

        if (!this.isAndroid) {
            this.logger.warn('Not in Android environment, Android methods will return null');
        }
    }

    detectAndroid() {
        return typeof window.AndroidBridge !== 'undefined';
    }

    setupMessenger() {
        // 接管全域接收器
        window.BridgeMessenger.onNativeMessage = (response) => {
            this.handleNativeMessage(response);
        };
    }

    /**
     * 處理來自 Android 的異步回調
     * @param {Object} response - { taskId, status, data, error }
     */
    handleNativeMessage(response) {
        const { taskId, status, data, error } = response;

        if (!this.pendingTasks.has(taskId)) {
            this.logger.warn(`Received message for unknown task: ${taskId}`);
            return;
        }

        const task = this.pendingTasks.get(taskId);

        // 清除超時計時器
        clearTimeout(task.timer);
        this.pendingTasks.delete(taskId);

        if (status === 'SUCCESS') {
            this.logger.debug(`Task ${taskId} completed successfully, data: ${JSON.stringify(data)}`);
            task.resolve(data);
        } else {

            const errorMsg = error ? `Code: ${error.code}, Msg: ${error.message}` : 'Unknown Error';
            this.logger.error(`Task ${taskId} failed: ${errorMsg}`);
            task.reject(new Error(errorMsg));
        }
    }

    /**
     * 調用 Android 異步任務 (推薦用於 DB 和耗時操作)
     * @param {string} action - 路由指令 (例如 'DB:queryExpenses')
     * @param {Object} payload - 參數物件
     * @param {number} timeoutMs - 超時設定 (預設 10000ms)
     * @returns {Promise<any>}
     */
    async callAsync(action, payload = {}, timeoutMs = 10000) {
        if (!this.isAndroid) {
            this.logger.warn(`Mocking Async Call: ${action}`);
            return Promise.resolve(null);
        }

        const taskId = this.generateUUID();

        return new Promise((resolve, reject) => {
            // 設定超時
            const timer = setTimeout(() => {
                if (this.pendingTasks.has(taskId)) {
                    this.pendingTasks.delete(taskId);
                    reject(new Error(`Task ${taskId} timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);

            // 掛起任務
            this.logger.debug(`Calling Async Action: ${action},payload: ${JSON.stringify(payload)}, Task ID: ${taskId}`);
            this.pendingTasks.set(taskId, { resolve, reject, timer });

            // 發送請求
            const message = JSON.stringify({
                taskId: taskId,
                action: action,
                payload: payload
            });

            try {
                window.AndroidBridge.postMessage(message);
            } catch (err) {
                clearTimeout(timer);
                this.pendingTasks.delete(taskId);
                reject(err);
            }
        });
    }

    generateUUID() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // =================================================================================
    // API Methods (All async)
    // =================================================================================

    // 常用異步封裝
    getDeviceInfo() { return this.callAsync('SYS:getDeviceInfo'); }
    getAppVersion() { return this.callAsync('SYS:getAppVersion'); }
    checkNetworkStatus() { return this.callAsync('SYS:checkNetworkStatus'); }
    openSettings() { return this.callAsync('SYS:openSettings'); }
    share(text, title = '分享') { return this.callAsync('SYS:share', { text, title }); }
    requestPermission(permission) { return this.callAsync('SYS:requestPermission', { permission }); }
    syncThemeColor(color) { return this.callAsync('SYS:syncThemeColor', { color }); }

    // 模組相關
    getSystemModulesList() { return this.callAsync('SYS:getSystemModulesList'); }
    getSchema(name) { return this.callAsync('SYS:getSchema', { name }); }
    getTechs(fileNames) { return this.callAsync('SYS:getTechs', { fileNames }); }


    // =================================================================================
    // Fetcher (用於獲取本地資源)
    // =================================================================================

    async fetchSystemModules(path, resultType = 'text') {
        const url = `${this.virtual_domain}/assets/www/systemModules/${path}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response[resultType]();
        } catch (error) {
            this.logger.error(`Error fetching system module from ${url}: ${error}`);
            return null;
        }
    }

    async fetch(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            return response;
        } catch (error) {
            this.logger.error(`Error fetching from ${url}: ${error}`);
            return null;
        }
    }
}