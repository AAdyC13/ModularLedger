/**
 * Setting Page
 * 設置頁面 - 應用設置選項
 */
import { BasePage } from './BasePage.js';

export class SettingPage extends BasePage {
    constructor(router) {
        super(router);
        this.scrollController = null;
    }

    /**
     * 初始化設置頁面
     */
    async init() {
        await super.init();

        // 初始化滾動控制器
        this.initScrollController();

        // 綁定事件
        this.bindEvents();
    }

    /**
     * 初始化滾動控制器
     */
    initScrollController() {
        const container = document.getElementById('main-content');
        const content = document.getElementById('setting-content-inner');
        const scrollbarThumb = document.getElementById('setting-scrollbar-thumb');

        if (!container || !content) {
            console.error('Setting page: Scroll elements not found');
            return;
        }

        // 從路由器的組件管理器創建 ScrollController 實例
        const componentsManager = this.router.componentsManager;
        if (componentsManager && typeof componentsManager.createComponent === 'function') {
            this.scrollController = componentsManager.createComponent('scrollController',
                container, content, scrollbarThumb);
            console.log('✓ ScrollController initialized');
        } else {
            console.warn('ComponentsManager not available, scroll not initialized');
        }
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 返回按鈕
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            this.addEventListener(backBtn, 'click', (e) => {
                e.preventDefault();
                this.navigate('pages/home.html');
            });
        }

        // 設置選項按鈕
        const settingBtns = document.querySelectorAll('.setting-option-btn');
        settingBtns.forEach((btn, index) => {
            this.addEventListener(btn, 'click', (e) => {
                e.preventDefault();
                console.log(`設置選項 ${index + 1} 點擊`);
                // TODO: 實現具體設置功能
            });
        });

        // 其他按鈕
        const menuBtns = document.querySelectorAll('.top-menu .menu-btn');
        menuBtns.forEach((btn, index) => {
            if (btn.id !== 'back-btn') {
                this.addEventListener(btn, 'click', (e) => {
                    e.preventDefault();
                    console.log(`按鈕${index + 1} 點擊`);
                });
            }
        });
    }

    /**
     * 頁面暫停（離開頁面時）
     */
    pause() {
        super.pause();
    }

    /**
     * 重新綁定 DOM
     */
    async rebind() {
        await super.rebind();

        // 重新初始化滾動控制器
        this.initScrollController();

        // 重新綁定事件
        this.bindEvents();
    }

    /**
     * 銷毀頁面
     */
    destroy() {
        // 銷毀滾動控制器
        if (this.scrollController && typeof this.scrollController.destroy === 'function') {
            this.scrollController.destroy();
            this.scrollController = null;
        }

        super.destroy();
    }
}
