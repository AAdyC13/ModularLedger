/**
 * Components Manager - 組件管理器
 * 負責註冊和管理可重用組件
 */

import { SettingPanel } from '../components/SettingPanel.js';
import { Calculator } from '../components/Calculator.js';

// 組件實例存儲
export let settingPanel = null;
export let calculator = null;

/**
 * 註冊所有全局組件
 */
export async function registerComponents() {
    try {
        // 初始化設定面板組件
        settingPanel = new SettingPanel();
        console.log('✓ SettingPanel component registered');

        // 初始化計算機組件
        calculator = new Calculator();
        console.log('✓ Calculator component registered');

        // 可以在這裡註冊更多組件
        // 例如：toast, modal, loading 等

    } catch (error) {
        console.error('組件註冊失敗:', error);
    }
}/**
 * 獲取組件實例
 * @param {string} componentName - 組件名稱
 */
export function getComponent(componentName) {
    const components = {
        settingPanel
    };

    return components[componentName] || null;
}

/**
 * 銷毀所有組件
 */
export function destroyComponents() {
    if (settingPanel && typeof settingPanel.destroy === 'function') {
        settingPanel.destroy();
    }

    if (calculator && typeof calculator.destroy === 'function') {
        calculator.destroy();
    }

    settingPanel = null;
    calculator = null;
}