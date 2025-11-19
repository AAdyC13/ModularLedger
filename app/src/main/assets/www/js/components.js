/**
 * Components Manager - 組件管理器（嚴格資源控制版本）
 * 負責預載入並註冊所有可重用組件
 * 統一管理組件的創建和訪問，外部不應直接 import 組件
 */

import { COMPONENTS } from '../config/resources.js';
import { SettingPanel } from '../components/SettingPanel.js';
import { Calculator } from '../components/Calculator.js';
import { ScrollController } from '../components/ScrollController.js';
import { RecordCalendar } from '../components/RecordCalendar.js';

// 組件類別映射
const COMPONENT_CLASSES = {
    SettingPanel,
    Calculator,
    ScrollController,
    RecordCalendar
};

// 單例組件實例存儲
export let components = {};
export let settingPanel = null;
export let calculator = null;
export let recordCalendar = null;

/**
 * 預載入所有組件 HTML 模板
 */
async function preloadComponentTemplates() {
    console.log('📦 Preloading component templates...');

    const templateCache = {};

    for (const config of COMPONENTS) {
        // 跳過沒有 HTML 的組件
        if (!config.html) {
            console.log(`  ⊘ ${config.name} has no template (utility component)`);
            continue;
        }

        try {
            const response = await fetch(config.html);
            if (response.ok) {
                templateCache[config.name] = await response.text();
                console.log(`  ✓ ${config.name} template preloaded`);
            } else {
                console.warn(`  ✗ Failed to preload ${config.name}:`, response.status);
            }
        } catch (error) {
            console.error(`  ✗ Error preloading ${config.name}:`, error);
        }
    }

    return templateCache;
}

/**
 * 註冊所有全局組件
 */
export async function registerComponents() {
    try {
        // 1. 預載入所有組件 HTML
        const templates = await preloadComponentTemplates();

        // 2. 創建組件管理器代理對象（用於注入到組件中）
        const componentsManagerProxy = {
            createComponent,
            getComponent
        };

        // 3. 實例化單例組件（注入 componentsManager）
        settingPanel = new SettingPanel(templates.settingPanel, componentsManagerProxy);
        components.settingPanel = settingPanel;
        console.log('✓ SettingPanel component registered');

        calculator = new Calculator(templates.calculator);
        components.calculator = calculator;
        console.log('✓ Calculator component registered');

        recordCalendar = new RecordCalendar(templates.recordCalendar);
        components.recordCalendar = recordCalendar;
        console.log('✓ RecordCalendar component registered');

        console.log('✓ All singleton components registered');

    } catch (error) {
        console.error('組件註冊失敗:', error);
    }
}

/**
 * 創建組件實例（支援單例和非單例）
 * @param {string} componentName - 組件名稱
 * @param {...any} args - 組件構造參數
 * @returns {Object|null} 組件實例
 */
export function createComponent(componentName, ...args) {
    const config = COMPONENTS.find(c => c.name === componentName);

    if (!config) {
        console.error(`Unknown component: ${componentName}`);
        return null;
    }

    // 如果是單例組件，返回已註冊的實例
    if (config.isSingleton) {
        return components[componentName] || null;
    }

    // 非單例組件，創建新實例
    const ComponentClass = COMPONENT_CLASSES[config.className];
    if (!ComponentClass) {
        console.error(`Component class not found: ${config.className}`);
        return null;
    }

    return new ComponentClass(...args);
}

/**
 * 獲取組件實例（僅用於單例組件）
 * @param {string} componentName - 組件名稱
 */
export function getComponent(componentName) {
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

    if (recordCalendar && typeof recordCalendar.destroy === 'function') {
        recordCalendar.destroy();
    }

    components = {};
    settingPanel = null;
    calculator = null;
    recordCalendar = null;
}