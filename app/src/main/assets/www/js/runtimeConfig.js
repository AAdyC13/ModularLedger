/**
 * Runtime Configuration - 運行時配置
 * 包含系統級別的配置信息
 */

const runtimeConfig = {
    /**
     * 模組白名單
     * 當 schema 載入失敗時,只允許載入白名單中的模組
     */
    whitelist: [
        'systemModule.Home',
        'systemModule.Recorder'
    ],
    indexPage: 'systemPage.Home',

    /**
     * 日誌等級
     * 可選值: 'debug', 'info', 'warn', 'error'
     */
    logLevel: 'debug',

    /**
     * 應用版本
     */
    version: '1.3.0',

    /**
     * 運行時超時設置 (秒)
     */
    runtimeTimeout_s: 30,

    /**
     * 模組加載超時設置 (秒)
     */
    moduleLoadTimeout_s: 5,
};

export default runtimeConfig;