class LoggerManager {
    constructor() {
        this.level = 'DEBUG';
    }

    shouldLog(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    output(type, message) {
        switch (type) {
            case 'DEBUG': {
                console.debug(message);
                break;
            }
            case 'INFO': {
                console.log(message);
                break;
            }
            case 'WARN': {
                console.warn(message);
                break;
            }
            case 'ERROR': {
                console.error(message);
                break;
            }
            case 'DEBUG_AUTO': {
                console.debug(message);
                break;
            }
            default: {
                console.log(message);
            }
        }
        // 這裡可改成 file 或 server
    }

    /**
     * 設置全局日誌等級
     * @param {string} level - 'DEBUG', 'INFO', 'WARN', 'ERROR'
     */
    setLevel(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        if (levels.includes(level)) {
            this.level = level;
        }
    }

    /**
     * 獲取當前日誌等級
     */
    getLevel() {
        return this.level;
    }
}
const loggerManager = new LoggerManager();
export { loggerManager };


/**
 * Logger 類，用於在不同模組中輸出統一格式的日誌。
 * 每個模組可以生成自己的 Logger 實例，帶上模組名稱。
 * 日誌輸出由 LoggerManager 統一管理，可支援全局日誌等級、輸出位置等。
 *
 * @example
 * import { createLogger } from './logger.js';
 *
 * const logger = createLogger('UserService');
 * logger.info('User login success');
 * logger.error('Token missing');
 */
export class Logger {
    /**
     * 建立 Logger 實例
     * @param {string} moduleName - 模組名稱，會在日誌中顯示，用於追蹤來源
     */
    constructor(moduleName) {
        this.moduleName = moduleName || 'Unknown';
        this.debug_auto_counter = 0;
    }

    /**
     * 格式化日誌訊息
     * @private
     * @param {string} level - 日誌等級，如 'INFO', 'DEBUG', 'ERROR'
     * @param {string} message - 要輸出的日誌訊息
     * @returns {string} 格式化後的日誌字串
     */
    format(level, message) {
        const time = new Date().toISOString();
        return `[${time}] [${level}] [${this.moduleName}] ${message}`;
    }

    /**
     * 處理參數數量錯誤
     * @private
     * @param {string} funcName - 函數名稱
     * @param {string} msg - 參數描述
     */
    errorHandler(funcName, msg) {
        this.error(`Logger.${funcName} ${msg}`);
        throw new Error(`Logger.${funcName} ${msg}`);
    }

    /**
     * 根據日誌等級輸出訊息
     * @private
     * @param {string} level - 日誌等級
     * @param {string} message - 日誌訊息
     */
    log(level, message) {
        if (loggerManager.shouldLog(level)) {
            loggerManager.output(level, this.format(level, message));
        }
    }

    /**
     * 輸出 DEBUG 級別日誌
     * @param {string} message - 日誌訊息
     */
    debug(message) {
        if (arguments.length !== 1) this.errorHandler('debug', 'expects exactly one argument');
        this.log('DEBUG', message);
    }

    /**
     * 輸出 INFO 級別日誌
     * @param {string} message - 日誌訊息
     */
    info(message) {
        if (arguments.length !== 1) this.errorHandler('info', 'expects exactly one argument');
        this.log('INFO', message);
    }

    /**
     * 輸出 WARN 級別日誌
     * @param {string} message - 日誌訊息
     */
    warn(message) {
        if (arguments.length !== 1) this.errorHandler('warn', 'expects exactly one argument');
        this.log('WARN', message);
    }

    /**
     * 輸出 ERROR 級別日誌
     * @param {string} message - 日誌訊息
     */
    error(message) {
        if (arguments.length !== 1) this.errorHandler('error', 'expects exactly one argument');
        this.log('ERROR', message);
    }

    debugA(message) {
        this.log('DEBUG_AUTO', `Auto debug #${++this.debug_auto_counter},\n {${message}}`);
    }


}