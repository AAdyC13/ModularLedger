/**
 * Home Page
 * 首頁邏輯 - 處理首頁特定的交互和事件
 */
import { BasePage } from './BasePage.js';

export class HomePage extends BasePage {
    constructor(router) {
        super(router);
        this.settingPanel = null;
        this.recordCalendar = null;
    }

    /**
     * 初始化首頁
     */
    async init() {
        await super.init();

        // 取得全域組件
        this.settingPanel = this.getComponent('settingPanel');
        this.recordCalendar = this.getComponent('recordCalendar');

        // 渲染 RecordCalendar 到 main-content
        if (this.recordCalendar) {
            this.recordCalendar.render('#main-content');
        }

        // 綁定事件
        this.bindMenuButtons();
    }

    /**
     * 綁定菜單按鈕事件
     */
    bindMenuButtons() {
        const menuBtns = document.querySelectorAll('.top-menu .menu-btn');

        // 日曆按鈕
        if (menuBtns[0]) {
            this.addEventListener(menuBtns[0], 'click', (e) => {
                e.preventDefault();
                if (this.recordCalendar) {
                    this.recordCalendar.switchView('calendar');
                    this.setActiveMenuButton(menuBtns[0]);
                }
            });
        }

        // 清單按鈕
        if (menuBtns[1]) {
            this.addEventListener(menuBtns[1], 'click', (e) => {
                e.preventDefault();
                if (this.recordCalendar) {
                    this.recordCalendar.switchView('list');
                    this.setActiveMenuButton(menuBtns[1]);
                }
            });
        }

        // 設定按鈕
        const settingBtn = document.getElementById('setting-btn');
        if (settingBtn) {
            this.addEventListener(settingBtn, 'click', (e) => {
                e.preventDefault();
                this.navigate('pages/setting.html');
            });
        }

        // 記一筆按鈕
        const newRecordBtn = document.getElementById('new-record-btn');
        if (newRecordBtn) {
            this.addEventListener(newRecordBtn, 'click', (e) => {
                e.preventDefault();
                this.navigate('pages/new_record.html');
            });
        }

        // 其他按鈕
        menuBtns.forEach(btn => {
            if (btn.id !== 'setting-btn' && btn.id !== 'new-record-btn' &&
                btn.textContent !== '日曆' && btn.textContent !== '清單') {
                this.addEventListener(btn, 'click', (e) => {
                    e.preventDefault();
                    console.log('按鈕點擊:', btn.textContent);
                });
            }
        });

        // 預設激活日曆按鈕
        if (menuBtns[0]) {
            this.setActiveMenuButton(menuBtns[0]);
        }
    }

    /**
     * 設置激活的菜單按鈕
     */
    setActiveMenuButton(activeBtn) {
        const menuBtns = document.querySelectorAll('.top-menu .menu-btn');
        menuBtns.forEach(btn => {
            if (btn.textContent === '日曆' || btn.textContent === '清單') {
                btn.classList.remove('active');
            }
        });
        activeBtn.classList.add('active');
    }

    /**
     * 頁面暫停（離開頁面時）
     */
    pause() {
        super.pause();
        // 確保設定面板關閉
        if (this.settingPanel) {
            this.settingPanel.close();
        }
    }

    /**
     * 重新綁定 DOM（重新進入頁面時，DOM 已重新渲染）
     */
    async rebind() {
        await super.rebind();

        // 重新取得全域組件引用（都是單例，引用不變）
        this.settingPanel = this.getComponent('settingPanel');
        this.recordCalendar = this.getComponent('recordCalendar');

        // 重新渲染 RecordCalendar
        if (this.recordCalendar) {
            this.recordCalendar.render('#main-content');
        }

        // 重新綁定所有事件到新 DOM
        this.bindMenuButtons();
    }

    /**
     * 頁面恢復（重新進入頁面時）
     * @deprecated 使用 rebind() 代替
     */
    resume() {
        super.resume();
        // 可以在這裡更新顯示或重新載入數據
    }
}

