/**
 * Router - 頁面路由管理器
 * 處理 SPA 的頁面導航和歷史記錄
 */
export class Router {
    constructor() {
        this.currentPage = null;
        this.currentPageInstance = null;
        this.history = [];

        this.init();
    }

    /**
     * 初始化路由器
     */
    init() {
        // 監聽瀏覽器返回按鈕
        window.addEventListener('popstate', (event) => {
            this.handlePopState(event);
        });
    }

    /**
     * 導航到指定頁面
     * @param {string} url - 頁面 URL
     * @param {object} options - 導航選項
     */
    async navigate(url, options = {}) {
        try {
            // 載入頁面內容
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();

            // 獲取應用容器
            const app = document.getElementById('app');
            if (!app) {
                throw new Error('App container not found');
            }

            // 清理當前頁面
            if (this.currentPageInstance && typeof this.currentPageInstance.destroy === 'function') {
                this.currentPageInstance.destroy();
            }

            // 更新 DOM
            app.innerHTML = html;

            // 執行頁面腳本
            await this.executePageScripts(app, url);

            // 更新瀏覽器歷史記錄
            if (!options.replace) {
                history.pushState({ page: url }, '', url);
            }

            // 記錄當前頁面
            this.currentPage = url;

        } catch (error) {
            console.error('頁面載入失敗:', error);
            this.handleError(error, url);
        }
    }

    /**
     * 執行頁面中的腳本
     * @param {HTMLElement} container - 頁面容器
     * @param {string} url - 頁面 URL
     */
    async executePageScripts(container, url) {
        const scripts = container.querySelectorAll('script');

        for (const script of scripts) {
            const newScript = document.createElement('script');

            if (script.src) {
                // 外部腳本
                newScript.src = script.src;
                await new Promise((resolve, reject) => {
                    newScript.onload = resolve;
                    newScript.onerror = reject;
                    script.parentNode.replaceChild(newScript, script);
                });
            } else {
                // 內聯腳本
                newScript.textContent = script.textContent;
                script.parentNode.replaceChild(newScript, script);
            }
        }

        // 嘗試載入對應的頁面 JS 模組
        await this.loadPageModule(url);
    }

    /**
     * 載入頁面對應的 JS 模組
     * @param {string} url - 頁面 URL
     */
    async loadPageModule(url) {
        console.log('Attempting to load page module for:', url);
        try {
            // 將 .html 替換為 .js
            const moduleUrl = url.replace('.html', '.js');
            // 動態導入模組
            const module = await import('/' + moduleUrl);

            // 如果模組導出了頁面類，實例化它
            if (module.HomePage) {
                const { settingPanel } = await import('./components.js');
                this.currentPageInstance = new module.HomePage(this, settingPanel);
            } else if (module.NewRecordPage) {
                this.currentPageInstance = new module.NewRecordPage(this);
            } else if (module.default) {
                this.currentPageInstance = new module.default(this);
            }

            // 將路由器掛載到 window，供頁面內腳本使用
            window.appRouter = this;
        } catch (error) {
            // 頁面沒有對應的 JS 模組，這是正常的
            console.log('No page module found for:', url);
        }
    }    /**
     * 處理瀏覽器返回按鈕
     * @param {PopStateEvent} event - popstate 事件
     */
    handlePopState(event) {
        if (event.state && event.state.page) {
            // 導航到歷史記錄中的頁面
            this.navigate(event.state.page, { replace: true });
        } else {
            // 返回首頁
            this.navigate('pages/home.html', { replace: true });
        }
    }

    /**
     * 返回上一頁
     */
    back() {
        window.history.back();
    }

    /**
     * 前進到下一頁
     */
    forward() {
        window.history.forward();
    }

    /**
     * 替換當前頁面
     * @param {string} url - 頁面 URL
     */
    replace(url) {
        this.navigate(url, { replace: true });
    }

    /**
     * 錯誤處理
     * @param {Error} error - 錯誤對象
     * @param {string} url - 出錯的 URL
     */
    handleError(error, url) {
        console.error('路由錯誤:', error);

        // 可以顯示錯誤頁面或使用傳統跳轉作為降級方案
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div class="error-page">
                    <h2>頁面載入失敗</h2>
                    <p>無法載入頁面: ${url}</p>
                    <button onclick="location.reload()">重新載入</button>
                </div>
            `;
        }
    }

    /**
     * 獲取當前頁面 URL
     */
    getCurrentPage() {
        return this.currentPage;
    }
}
