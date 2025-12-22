class LoggerManager {
    constructor() {
        this.level = 'DEBUG';
        this.logListeners = [];
    }

    addLogListener(callback) {
        this.logListeners.push(callback);
    }

    setUiAgent(uiAgent) {
        this.uiAgent = uiAgent;
    }

    shouldLog(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    output(type, moduleName, ...args) {
        // 1. Normal console log, with multi-argument support
        const consoleLogMethod = {
            'DEBUG': console.debug,
            'INFO': console.log,
            'WARN': console.warn,
            'ERROR': console.error,
            'DEBUG_AUTO': console.debug
        }[type] || console.log;
        consoleLogMethod(`[${moduleName}]`, ...args);

        // 2. Forward formatted log to in-app listeners
        if (this.logListeners.length > 0) {
            const d = new Date();
            const time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
            const messageString = args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return '[Unserializable Object]';
                    }
                }
                return String(arg);
            }).join(' ');

            const formattedMessage = `[${time}] [${type}] [${moduleName}] ${messageString}`;

            this.logListeners.forEach(listener => {
                try {
                    listener(type, formattedMessage);
                } catch (e) {
                    console.error('Error in log listener:', e);
                }
            });
        }
    }

    /**
     * 設置全局日誌等級
     * @param {string} level - 'DEBUG', 'INFO', 'WARN', 'ERROR'
     */
    setLevel(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const upperCaseLevel = level.toUpperCase();
        if (levels.includes(upperCaseLevel)) {
            this.level = upperCaseLevel;
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
     * 根據日誌等級輸出訊息
     * @private
     */
    log(level, ...args) {
        if (loggerManager.shouldLog(level)) {
            loggerManager.output(level, this.moduleName, ...args);
        }
    }

    /**
     * 輸出 DEBUG 級別日誌
     */
    debug(...args) {
        this.log('DEBUG', ...args);
    }

    /**
     * 輸出 INFO 級別日誌
     */
    info(...args) {
        this.log('INFO', ...args);
    }

    /**
     * 輸出 WARN 級別日誌
     */
    warn(...args) {
        this.log('WARN', ...args);
    }

    /**
     * 輸出 ERROR 級別日誌
     */
    error(...args) {
        this.log('ERROR', ...args);
    }

    debugA(message) {
        this.log('DEBUG_AUTO', `Auto debug #${++this.debug_auto_counter},\n {${message}}`);
    }


}