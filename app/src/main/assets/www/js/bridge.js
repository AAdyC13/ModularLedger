/**
 * Android Bridge - WebView 統一的接口與 Android 原生層交互
 */
export class Bridge {
    constructor(logger) {
        this.isAndroid = this.detectAndroid();
        this.logger = logger;
        this.virtual_domain = "https://appassets.androidplatform.net";
        if (!this.isAndroid) {
            this.logger.warn('Not in Android environment, Android methods will return null');
        }
    }

    detectAndroid() {
        return typeof window.AndroidBridge !== 'undefined'; // 檢測是否在 Android WebView 環境中
    }

    /**
     * 調用 Android 原生方法（同步）
     * @param {string} method - 方法名
     * @param {...any} args - 參數（自動處理編解碼）
     * @returns {any} - 返回結果（自動解碼）
     */
    callSync(method, ...args) {
        if (!this.isAndroid) {
            this.logger.warn(`Not in Android environment, now method: ${method}`);
            return null;
        }

        try {
            const fn = window.AndroidBridge[method];
            if (typeof fn === 'function') {

                // 自動編碼複雜類型參數
                const encodedArgs = args.map(arg => {
                    if (arg !== null && typeof arg === 'object') {
                        return this.encodeRequest(arg);
                    }
                    return arg;
                });
                const result = window.AndroidBridge[method](...encodedArgs);
                //  this.logger.debug(`Called Android method: ${method} with args: ${JSON.stringify(args)},\n value: ${result}`);
                // 自動解碼複雜類型返回值
                if (typeof result === 'string') {
                    try {
                        const decoded = this.decodeResponse(result);
                        return decoded !== null ? decoded : result;
                    } catch {
                        return result;
                    }
                }
                return result;
            } else {
                this.logger.error(`Method ${method} not found in AndroidBridge`);
                return null;
            }
        } catch (error) {
            this.logger.error(`Error calling ${method}:` + error);
            return null;
        }
    }

    async fetchSystemModules(path, resultType = 'text') {
        const url = `${this.virtual_domain}/assets/www/systemModules/${path}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.logger.error(`Failed to fetch system module from ${url}`);
                return null;
            }
            const data = await response[resultType]();
            return data;
        } catch (error) {
            this.logger.error(`Error fetching system module from ${url}: ${error}`);
            return null;
        }
    }
    async fetch(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.logger.error(`Failed to fetch from ${url}`);
                return null;
            }
            return response;
        }
        catch (error) {
            this.logger.error(`Error fetching from ${url}: ${error}`);
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
        return this.callSync('getDeviceInfo');
    }

    /**
     * 保存數據到本地存儲
     * @param {string} key - 鍵
     * @param {any} value - 值
     */
    saveData(key, value) {
        return this.callSync('saveData', key, value);
    }

    /**
     * 從本地存儲讀取數據
     * @param {string} key - 鍵
     * @returns {any|null} - 讀取的數據
     */
    loadData(key) {
        return this.callSync('loadData', key);
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

    // /**
    //  * 打開外部瀏覽器
    //  * @param {string} url - URL
    //  */
    // openExternalBrowser(url) {
    //     return this.callSync('openExternalBrowser', url);
    // }

    exitApp() {
        this.logger.info('Exiting application');
        return this.callSync('exitApp');
    }

    /**
     * JSON 編碼器：將複雜資料包裝為 JSON 字串
     * 只用於 Object/Array 等複雜類型，基本類型 (string/number/boolean) 不需使用
     * @param {Object|Array} content - 要包裝的複雜內容
     * @returns {string} - 格式化的 JSON 字串: {"type":"類型", "content":內容}
     */
    encodeRequest(content) {
        let type;

        if (Array.isArray(content)) {
            type = 'Array';
        } else if (typeof content === 'object' && content !== null) {
            type = 'Object';
        } else {
            throw new Error('encodeRequest only for complex types (Object/Array). Use direct parameter for primitives.');
        }

        return JSON.stringify({
            type: type,
            content: content
        });
    }

    /**
     * JSON 解碼器：解析後端返回的複雜資料
     * @param {string} responseString - 後端返回的 JSON 字串
     * @returns {any|null} - 解析後的 content，若失敗返回 null
     */
    decodeResponse(responseString) {
        if (!responseString) {
            return null;
        }

        try {
            const response = JSON.parse(responseString);
            if (response && typeof response === 'object' && 'type' in response && 'content' in response) {
                return response.content;
            }
            this.logger.warn('Invalid response format:' + response);
            return null;
        } catch (error) {
            this.logger.error('Error decoding response:' + error);
            return null;
        }
    }
}

