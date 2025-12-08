/**
 * BasePage - 頁面基類
 * 提供統一的頁面生命週期管理和事件處理機制
 */
export class BasePage {
    constructor(router) {
        this.router = router;
        this.isActive = false;
        this.eventHandlers = []; // 儲存所有事件監聽器，用於清理
    }

    /**
     * 頁面初始化（首次載入或 cache: false 時調用）
     * 子類應該覆寫此方法來實作頁面特定邏輯
     */
    async init() {
        this.isActive = true;
        console.log(`✓ ${this.constructor.name} initialized`);
    }

    /**
     * 頁面暫停（cache: true 時離開頁面調用）
     * 保留實例和狀態，但停止活動
     */
    pause() {
        this.isActive = false;
        // 清理所有舊的事件監聽器（因為 DOM 會被銷毀）
        this.removeAllEventListeners();
        console.log(`⏸ ${this.constructor.name} paused`);
    }

    /**
     * 頁面恢復（cache: true 時重新進入頁面調用）
     * 恢復頁面活動，但不重新初始化
     * @deprecated 使用 rebind() 代替，因為 DOM 已重新渲染
     */
    resume() {
        this.isActive = true;
        console.log(`▶ ${this.constructor.name} resumed`);
    }

    /**
     * 重新綁定 DOM（cache: true 時重新進入頁面調用）
     * DOM 已重新渲染，需要重新獲取 DOM 引用並綁定事件
     * 子類應該覆寫此方法來重新初始化 DOM 相關邏輯
     */
    async rebind() {
        this.isActive = true;
        console.log(`🔗 ${this.constructor.name} rebinding DOM...`);

        // 子類應該覆寫此方法，重新執行 DOM 綁定邏輯
        // 例如：重新獲取 DOM 引用、重新綁定事件、重新創建 ScrollController

        console.log(`✓ ${this.constructor.name} rebound`);
    }

    /**
     * 頁面銷毀（cache: false 時離開頁面調用）
     * 清理所有資源和事件監聽器
     */
    destroy() {
        this.isActive = false;
        this.removeAllEventListeners();
        console.log(`🗑 ${this.constructor.name} destroyed`);
    }

    /**
     * 統一的事件綁定方法
     * 自動記錄事件監聽器以便後續清理
     * @param {Element} element - DOM 元素
     * @param {string} event - 事件名稱
     * @param {Function} handler - 事件處理函數
     * @param {object} options - addEventListener 選項
     */
    addEventListener(element, event, handler, options = {}) {
        if (!element) {
            console.warn(`Cannot add event listener: element is null`);
            return;
        }

        element.addEventListener(event, handler, options);
        this.eventHandlers.push({ element, event, handler, options });
    }

    /**
     * 清理所有事件監聽器
     * 在 destroy() 時自動調用
     */
    removeAllEventListeners() {
        this.eventHandlers.forEach(({ element, event, handler, options }) => {
            if (element) {
                element.removeEventListener(event, handler, options);
            }
        });
        this.eventHandlers = [];
        console.log(`  ✓ Removed ${this.eventHandlers.length} event listeners`);
    }

    /**
     * 獲取全域組件
     * @param {string} name - 組件名稱 ('settingPanel' | 'calculator')
     */
    getComponent(name) {
        return this.router.getGlobalComponent(name);
    }

    /**
     * 導航到其他頁面
     * @param {string} url - 頁面 URL
     * @param {object} options - 導航選項
     */
    navigate(url, options = {}) {
        return this.router.navigate(url, options);
    }

    /**
     * 返回上一頁
     */
    back() {
        return this.router.back();
    }
}
