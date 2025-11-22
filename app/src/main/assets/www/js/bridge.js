/**
 * Android Bridge - WebView 與 Android 原生通訊
 * 提供統一的接口與 Android 原生層交互
 */
class AndroidBridge {
    constructor() {
        this.isAndroid = this.detectAndroid();
        this.messageQueue = [];
        this.callbacks = new Map();
        this.callbackId = 0;
    }

    /**
     * 檢測是否在 Android WebView 環境中
     */
    detectAndroid() {
        return typeof Android !== 'undefined';
    }

    /**
     * 調用 Android 原生方法
     * @param {string} method - 方法名
     * @param {object} params - 參數
     * @returns {Promise} - 返回 Promise
     */
    call(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.isAndroid) {
                console.warn(`[Bridge] Not in Android environment, method: ${method}`);
                resolve(null);
                return;
            }

            try {
                // 生成回調 ID
                const callbackId = this.callbackId++;

                // 存儲回調
                this.callbacks.set(callbackId, { resolve, reject });

                // 構建消息
                const message = {
                    id: callbackId,
                    method: method,
                    params: params
                };

                // 調用 Android 方法
                if (Android[method]) {
                    const result = Android[method](JSON.stringify(message));

                    // 如果是同步返回
                    if (result !== undefined) {
                        resolve(JSON.parse(result));
                        this.callbacks.delete(callbackId);
                    }
                } else {
                    reject(new Error(`Method ${method} not found in Android`));
                    this.callbacks.delete(callbackId);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Android 調用此方法返回結果
     * @param {string} callbackId - 回調 ID
     * @param {string} result - 結果 JSON 字符串
     */
    handleCallback(callbackId, result) {
        const callback = this.callbacks.get(callbackId);
        if (callback) {
            try {
                const data = JSON.parse(result);
                if (data.error) {
                    callback.reject(new Error(data.error));
                } else {
                    callback.resolve(data);
                }
            } catch (error) {
                callback.reject(error);
            }
            this.callbacks.delete(callbackId);
        }
    }

    /**
     * 顯示 Toast 消息
     * @param {string} message - 消息內容
     */
    async showToast(message) {
        return this.call('showToast', { message });
    }

    /**
     * 獲取設備信息
     */
    async getDeviceInfo() {
        return this.call('getDeviceInfo');
    }

    /**
     * 保存數據到本地存儲
     * @param {string} key - 鍵
     * @param {any} value - 值
     */
    async saveData(key, value) {
        return this.call('saveData', { key, value: JSON.stringify(value) });
    }

    /**
     * 從本地存儲讀取數據
     * @param {string} key - 鍵
     */
    async loadData(key) {
        const result = await this.call('loadData', { key });
        return result ? JSON.parse(result.value) : null;
    }

    /**
     * 請求權限
     * @param {string} permission - 權限名稱
     */
    async requestPermission(permission) {
        return this.call('requestPermission', { permission });
    }

    /**
     * 打開系統設置
     */
    async openSettings() {
        return this.call('openSettings');
    }

    /**
     * 分享內容
     * @param {object} content - 分享內容
     */
    async share(content) {
        return this.call('share', content);
    }

    /**
     * 獲取應用版本
     */
    async getAppVersion() {
        return this.call('getAppVersion');
    }

    /**
     * 檢查網絡狀態
     */
    async checkNetworkStatus() {
        return this.call('checkNetworkStatus');
    }

    /**
     * 打開外部瀏覽器
     * @param {string} url - URL
     */
    async openExternalBrowser(url) {
        return this.call('openExternalBrowser', { url });
    }

    /**
     * 退出應用
     */
    async exitApp() {
        return this.call('exitApp');
    }
}

// 創建全局 bridge 實例
const bridge = new AndroidBridge();

// 將 handleCallback 暴露到全局作用域，供 Android 調用
window.handleAndroidCallback = (callbackId, result) => {
    bridge.handleCallback(callbackId, result);
};

// 導出 bridge 實例
export default bridge;
