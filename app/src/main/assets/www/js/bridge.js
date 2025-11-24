import { createLogger } from './logger.js';
/**
 * Android Bridge - WebView 統一的接口與 Android 原生層交互
 */
class AndroidBridge {
    constructor() {
        this.isAndroid = this.detectAndroid();
        this.logger = createLogger('AndroidBridge');
    }

    /**
     * 檢測是否在 Android WebView 環境中
     */
    detectAndroid() {
        return typeof window.AndroidBridge !== 'undefined';
    }

    /**
     * 調用 Android 原生方法（同步）
     * @param {string} method - 方法名
     * @param {...any} args - 參數
     * @returns {any} - 返回結果
     */
    callSync(method, ...args) {
        if (!this.isAndroid) {
            console.warn(`[Bridge] Not in Android environment, method: ${method}`);
            return null;
        }

        try {
            if (typeof window.AndroidBridge[method] === 'function') {
                const result = window.AndroidBridge[method](...args);
                return result;
            } else {
                console.error(`[Bridge] Method ${method} not found in AndroidBridge`);
                return null;
            }
        } catch (error) {
            console.error(`[Bridge] Error calling ${method}:`, error);
            return null;
        }
    }

    /**
     * 獲取測試 JSON 數據
     * @returns {object|null} - 解析後的 JSON 對象
     */
    getTestJson() {
        try {
            const jsonString = this.callSync('getTestJson');
            return jsonString ? JSON.parse(jsonString) : null;
        } catch (error) {
            console.error('[Bridge] Error parsing JSON:', error);
            return null;
        }
    }

    /**
     * 顯示 Toast 消息
     * @param {string} message - 消息內容
     */
    showToast(message) {
        return this.callSync('showToast', message);
    }

    /**
     * 獲取設備信息
     * @returns {object|null} - 設備信息對象
     */
    getDeviceInfo() {
        try {
            const infoString = this.callSync('getDeviceInfo');
            return infoString ? JSON.parse(infoString) : null;
        } catch (error) {
            console.error('[Bridge] Error parsing device info:', error);
            return null;
        }
    }

    /**
     * 保存數據到本地存儲
     * @param {string} key - 鍵
     * @param {any} value - 值
     */
    saveData(key, value) {
        return this.callSync('saveData', key, JSON.stringify(value));
    }

    /**
     * 從本地存儲讀取數據
     * @param {string} key - 鍵
     * @returns {any|null} - 讀取的數據
     */
    loadData(key) {
        try {
            const dataString = this.callSync('loadData', key);
            return dataString ? JSON.parse(dataString) : null;
        } catch (error) {
            console.error('[Bridge] Error parsing loaded data:', error);
            return null;
        }
    }

    /**
     * 請求權限
     * @param {string} permission - 權限名稱
     */
    requestPermission(permission) {
        return this.callSync('requestPermission', permission);
    }

    /**
     * 打開系統設置
     */
    openSettings() {
        return this.callSync('openSettings');
    }

    /**
     * 分享內容
     * @param {string} text - 分享文本
     * @param {string} title - 分享標題
     */
    share(text, title = '分享') {
        return this.callSync('share', text, title);
    }

    /**
     * 獲取應用版本
     * @returns {string|null} - 版本號
     */
    getAppVersion() {
        return this.callSync('getAppVersion');
    }

    /**
     * 檢查網絡狀態
     * @returns {boolean|null} - 是否有網絡連接
     */
    checkNetworkStatus() {
        return this.callSync('checkNetworkStatus');
    }

    /**
     * 打開外部瀏覽器
     * @param {string} url - URL
     */
    openExternalBrowser(url) {
        return this.callSync('openExternalBrowser', url);
    }

    /**
     * 退出應用
     */
    exitApp() {
        return this.callSync('exitApp');
    }
}

// 創建全局 bridge 實例
const bridge = new AndroidBridge();

// 同時掛載到 window 供非模組環境使用
window.bridge = bridge;

// 導出 bridge 實例
export default bridge;
