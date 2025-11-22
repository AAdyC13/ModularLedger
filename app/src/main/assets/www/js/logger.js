class LoggerManager {
    constructor() {
        if (!LoggerManager.instance) {
            this.level = 'DEBUG'; // 全局日誌等級
            LoggerManager.instance = this;
        }
        return LoggerManager.instance;
    }

    shouldLog(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    output(message) {
        console.log(message); // 這裡可改成 file 或 server
    }
}

const loggerManager = new LoggerManager();
Object.freeze(loggerManager);


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
        /** @private */
        this.moduleName = moduleName || 'Unknown';
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
     * 根據日誌等級輸出訊息
     * @private
     * @param {string} level - 日誌等級
     * @param {string} message - 日誌訊息
     */
    log(level, message) {
        if (loggerManager.shouldLog(level)) {
            loggerManager.output(this.format(level, message));
        }
    }

    /**
     * 輸出 DEBUG 級別日誌
     * @param {string} message - 日誌訊息
     */
    debug(message) { this.log('DEBUG', message); }

    /**
     * 輸出 INFO 級別日誌
     * @param {string} message - 日誌訊息
     */
    info(message) { this.log('INFO', message); }

    /**
     * 輸出 WARN 級別日誌
     * @param {string} message - 日誌訊息
     */
    warn(message) { this.log('WARN', message); }

    /**
     * 輸出 ERROR 級別日誌
     * @param {string} message - 日誌訊息
     */
    error(message) { this.log('ERROR', message); }
}

/**
 * 工廠函數，生成指定模組名稱的 Logger 實例
 * @param {string} moduleName - 模組名稱，用於日誌追蹤
 * @returns {Logger} Logger 實例
 *
 * @example
 * import { createLogger } from './logger.js';
 * const logger = createLogger('AuthController');
 * logger.info('Token valid');
 */
export function createLogger(moduleName) {
    return new Logger(moduleName);
}