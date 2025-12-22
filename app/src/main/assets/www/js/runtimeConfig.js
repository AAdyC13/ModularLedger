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
        'system.HomePage',
        'system.Recorder',
        'system.ModuleShop'
    ],
    layoutIDs: {
        'tcb': 'tcb-layout',
        'bottom-nav': 'bottom-nav-layout',
        'drawer': 'drawer-layout',
        'tabs': 'tab-layout',
        'full': 'fullscreen-layout',
        'search': 'search-layout',
        'master-detail': 'master-detail-layout',
        'wizard': 'wizard-layout'
    },
    preLoadPages: [
        { pageID: 'systemPage.Home', layoutID: 'tcb' },
        { pageID: 'systemPage.Recorder', layoutID: 'full' },
        { pageID: 'systemPage.Settings', layoutID: 'full' },
        { pageID: 'systemPage.Accounts', layoutID: 'tabs' },
        { pageID: 'systemPage.Searcher', layoutID: 'search' },
        { pageID: 'system.ModuleShop.Main', layoutID: 'full' }
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
    version: '0.1.0'
};

export default runtimeConfig;