/**
 * SettingPanel Component
 * 設定面板組件 - 處理設定面板的開關和滾動交互
 */
export class SettingPanel {
    constructor(preloadedHtml = null, componentsManager = null) {
        this.settingPanel = null;
        this.settingOverlay = null;
        this.settingContent = null;
        this.settingContentInner = null;
        this.scrollbarThumb = null;
        this.templateHtml = preloadedHtml;  // 接收預載入的 HTML
        this.isInjected = false;  // 是否已注入 DOM
        this.scrollController = null;  // 滾動控制器
        this.componentsManager = componentsManager;  // 組件管理器引用

        this.init();
    }

    /**
     * 初始化組件
     */
    async init() {
        // 注入預載入的 HTML 模板
        if (!this.isInjected && this.templateHtml) {
            this.injectTemplate();
            this.isInjected = true;
        }

        // 獲取 DOM 元素
        this.initElements();

        // 綁定事件
        this.bindEvents();

        // 初始化滾動條
        this.initScrollbar();
    }

    /**
     * 注入預載入的 HTML 模板到 DOM
     */
    injectTemplate() {
        if (!this.templateHtml) {
            console.error('SettingPanel template not preloaded');
            return;
        }

        // 將模板插入到 body 中
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.templateHtml;

        // 將所有子元素添加到 body
        while (tempDiv.firstChild) {
            document.body.appendChild(tempDiv.firstChild);
        }

        console.log('✓ SettingPanel template injected');
    }

    /**
     * 初始化 DOM 元素引用
     */
    initElements() {
        this.settingPanel = document.getElementById('setting-panel');
        this.settingOverlay = document.getElementById('setting-overlay');
        this.settingContent = document.getElementById('setting-content');
        this.settingContentInner = document.getElementById('setting-content-inner');
        this.scrollbarThumb = document.getElementById('scrollbar-thumb');
    }

    /**
     * 綁定事件監聽器
     */
    bindEvents() {
        // 關閉按鈕
        const closeBtn = document.getElementById('close-setting');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.close();
            });
        }

        // 遮罩點擊關閉
        if (this.settingOverlay) {
            this.settingOverlay.addEventListener('click', () => {
                this.close();
            });
        }

        // 設定項目點擊事件
        this.bindSettingItems();
    }



    /**
     * 綁定設定項目點擊事件
     */
    bindSettingItems() {
        document.querySelectorAll('.setting-item').forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onSettingItemClick(index + 1, item);
            });
        });
    }

    /**
     * 設定項目點擊回調（可被覆寫）
     */
    onSettingItemClick(index, element) {
        console.log('設定項目:', index);
    }

    /**
     * 初始化滾動條
     */
    initScrollbar() {
        if (!this.settingContent || !this.settingContentInner || !this.scrollbarThumb) return;
        if (!this.componentsManager) {
            console.error('SettingPanel: componentsManager not provided');
            return;
        }

        // 通過組件管理器創建 ScrollController 實例
        this.scrollController = this.componentsManager.createComponent(
            'scrollController',
            this.settingContent,
            this.settingContentInner,
            this.scrollbarThumb
        );
    }

    /**
     * 打開設定面板
     */
    open() {
        if (this.settingOverlay && this.settingPanel) {
            this.settingOverlay.classList.add('active');
            this.settingPanel.classList.add('active');
        }
    }

    /**
     * 關閉設定面板
     */
    close() {
        if (this.settingOverlay && this.settingPanel) {
            this.settingOverlay.classList.remove('active');
            this.settingPanel.classList.remove('active');
        }
    }

    /**
     * 切換設定面板開關狀態
     */
    toggle() {
        if (this.settingPanel && this.settingPanel.classList.contains('active')) {
            this.close();
        } else {
            this.open();
        }
    }
}
