/**
 * Application Resources Configuration
 * 應用資源配置 - 統一管理所有需要預載入的資源
 */

/**
 * 組件資源配置
 */
export const COMPONENTS = [
    {
        name: 'scrollController',
        className: 'ScrollController',
        html: null,  // 工具組件，無 HTML 模板
        js: 'components/ScrollController.js',
        isSingleton: false  // 非單例，每次創建新實例
    },
    {
        name: 'calculator',
        className: 'Calculator',
        html: 'components/Calculator.html',
        js: 'components/Calculator.js',
        isSingleton: true  // 單例組件
    },
    {
        name: 'settingPanel',
        className: 'SettingPanel',
        html: 'components/SettingPanel.html',
        js: 'components/SettingPanel.js',
        isSingleton: true  // 單例組件
    },
    {
        name: 'recordCalendar',
        className: 'RecordCalendar',
        html: 'components/RecordCalendar.html',
        js: 'components/RecordCalendar.js',
        isSingleton: true  // 單例組件
    }
];

/**
 * 頁面資源配置
 */
export const PAGES = [
    {
        name: 'home',
        className: 'HomePage',
        html: 'pages/home.html',
        js: 'pages/home.js',
        cache: true  // 快取頁面，保留狀態
    },
    {
        name: 'new_record',
        className: 'NewRecordPage',
        html: 'pages/new_record.html',
        js: 'pages/new_record.js',
        cache: false  // 不快取，每次重新初始化
    },
    {
        name: 'setting',
        className: 'SettingPage',
        html: 'pages/setting.html',
        js: 'pages/setting.js',
        cache: true  // 快取頁面，保留狀態
    }
];

/**
 * 資源配置彙總
 */
export const RESOURCES = {
    components: COMPONENTS,
    pages: PAGES
};
