/**
 * Router - 頁面路由管理器（嚴格資源控制版本）
 * 處理 SPA 的頁面導航和歷史記錄
 */
import { PAGES } from '../config/resources.js';

export class Router {
    constructor() {
        this.currentPage = null;
        this.currentPageInstance = null;
        this.history = [];
        this.pageCache = {};       // 頁面 HTML 快取
        this.pageModules = {};     // 頁面 JS 模組快取（類別定義）
        this.pageInstances = {};   // 頁面實例快取（cache: true 的頁面）
        this.pageConfigs = {};     // 頁面配置快取（從 PAGES 讀取）
        this.globalComponents = {}; // 全域組件引用
        this.componentsManager = null; // 組件管理器引用

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
     *   - replace: 是否替換當前頁面
     *   - skipAnimation: 是否跳過動畫
     *   - animation: 動畫類型
     *     - undefined/null: 使用預設 fade 動畫
     *     - string: 使用內建動畫（如 'fade', 'slide' 等）
     *     - function(stage, app): 自定義動畫函數，stage='exit'|'enter'
     */
    async navigate(url, options = {}) {
        try {
            // 獲取應用容器
            const app = document.getElementById('app');
            if (!app) {
                throw new Error('App container not found');
            }

            const animation = options.animation; // undefined = 預設 fade

            // 1. 執行離開動畫（如果不是首次載入）
            if (this.currentPage && !options.skipAnimation) {
                await this.executeExitAnimation(app, animation);
            }

            // 2. 從快取讀取頁面 HTML（永遠不 fetch）
            const html = this.pageCache[url];
            if (!html) {
                throw new Error(`Page not preloaded: ${url}`);
            }
            console.log('✓ Loaded from cache:', url);

            // 3. 處理當前頁面實例（根據 cache 配置）
            if (this.currentPageInstance) {
                const currentConfig = this.pageConfigs[this.currentPage];

                if (currentConfig && currentConfig.cache) {
                    // cache: true - 暫停頁面，保留實例
                    if (typeof this.currentPageInstance.pause === 'function') {
                        this.currentPageInstance.pause();
                    }
                } else {
                    // cache: false - 銷毀頁面，清理資源
                    if (typeof this.currentPageInstance.destroy === 'function') {
                        this.currentPageInstance.destroy();
                    }
                }
            }

            // 4. 更新 DOM
            app.innerHTML = html;

            // 清除所有動畫 class（防止殘留）
            app.className = '';

            // 5. 執行頁面腳本
            await this.executePageScripts(app, url);

            // 6. 記錄當前頁面（WebView 環境不需要修改 URL）
            this.currentPage = url;

            // 7. 將頁面添加到內部歷史記錄
            if (!options.replace) {
                this.history.push(url);
            }

            // 8. 執行進入動畫
            if (!options.skipAnimation) {
                await this.executeEnterAnimation(app, animation);
            }

        } catch (error) {
            console.error('頁面載入失敗:', error);
            this.handleError(error, url);
        }
    }

    /**
     * 等待指定時間
     * @param {number} ms - 毫秒
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 執行頁面離開動畫
     * @param {HTMLElement} app - 應用容器
     * @param {string|function} animation - 動畫類型或自定義函數
     * @returns {Promise<void>}
     */
    async executeExitAnimation(app, animation) {
        if (typeof animation === 'function') {
            // 自定義動畫：由調用者完全控制
            await animation('exit', app);
        } else if (animation && animation !== 'fade') {
            // 內建動畫：未來添加的重複性動畫
            app.classList.add(`page-exit-${animation}`);
            await this.wait(300);
        } else {
            // 預設 fade 動畫
            app.classList.add('page-exit-fade');
            await this.wait(300);
        }
    }

    /**
     * 執行頁面進入動畫
     * @param {HTMLElement} app - 應用容器
     * @param {string|function} animation - 動畫類型或自定義函數
     * @returns {Promise<void>}
     */
    async executeEnterAnimation(app, animation) {
        if (typeof animation === 'function') {
            // 自定義動畫：由調用者完全控制
            await animation('enter', app);
        } else if (animation && animation !== 'fade') {
            // 內建動畫：未來添加的重複性動畫
            app.classList.add(`page-enter-${animation}`);
            app.offsetHeight; // 觸發重排
            await this.wait(300);
            app.classList.remove(`page-enter-${animation}`);
        } else {
            // 預設 fade 動畫
            app.classList.add('page-enter-fade');
            app.offsetHeight; // 觸發重排
            await this.wait(300);
            app.classList.remove('page-enter-fade');
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
     * 載入頁面對應的 JS 模組並管理實例生命週期
     * @param {string} url - 頁面 URL
     */
    async loadPageModule(url) {
        console.log('Loading page module for:', url);

        try {
            const config = this.pageConfigs[url];
            const module = this.pageModules[url];

            if (!module) {
                console.log('No page module found for:', url);
                return;
            }

            // 檢查是否需要重用快取實例
            if (config && config.cache && this.pageInstances[url]) {
                console.log('  ↻ Reusing cached instance');
                this.currentPageInstance = this.pageInstances[url];

                // DOM 已重新渲染，需要重新綁定
                // 調用 rebind() 讓頁面重新獲取 DOM 引用並綁定事件
                if (typeof this.currentPageInstance.rebind === 'function') {
                    await this.currentPageInstance.rebind();
                } else if (typeof this.currentPageInstance.resume === 'function') {
                    // 降級：如果沒有 rebind，調用 resume（但可能失效）
                    console.warn('Page instance missing rebind() method, using resume() (may cause issues)');
                    this.currentPageInstance.resume();
                }
                return;
            }

            // 創建新實例（從模組中取得類別並實例化）
            const PageClass = this.getPageClass(module);
            if (!PageClass) {
                console.warn('No valid page class found in module');
                return;
            }

            this.currentPageInstance = new PageClass(this);
            console.log('  ✓ New instance created:', PageClass.name);

            // 根據 cache 配置決定是否保存實例
            if (config && config.cache) {
                this.pageInstances[url] = this.currentPageInstance;
                console.log('  💾 Instance cached for reuse');
            }

            // 調用頁面初始化方法
            if (typeof this.currentPageInstance.init === 'function') {
                await this.currentPageInstance.init();
            }

            // 將路由器掛載到 window，供頁面內腳本使用
            window.appRouter = this;

        } catch (error) {
            console.error('Failed to load page module:', error);
        }
    }

    /**
     * 從模組中取得頁面類別
     * @param {object} module - 頁面模組
     * @returns {Function|null} - 頁面類別
     */
    getPageClass(module) {
        // 優先使用 default export
        if (module.default) {
            return module.default;
        }

        // 檢查常見的頁面類別名稱
        const classNames = ['HomePage', 'NewRecordPage'];
        for (const name of classNames) {
            if (module[name]) {
                return module[name];
            }
        }

        // 嘗試找到任何導出的類別
        for (const key in module) {
            if (typeof module[key] === 'function' && module[key].prototype) {
                return module[key];
            }
        }

        return null;
    }    /**
     * 處理瀏覽器返回按鈕（WebView 環境中通常不會觸發）
     * @param {PopStateEvent} event - popstate 事件
     */
    handlePopState(event) {
        // 在 WebView 中，Android 返回鍵會被原生處理
        // 這個方法主要用於瀏覽器調試時
        this.back();
    }

    /**
     * 返回上一頁
     */
    back() {
        if (this.history.length > 1) {
            // 移除當前頁面
            this.history.pop();
            // 獲取前一頁
            const previousPage = this.history[this.history.length - 1];
            // 導航到前一頁（預設使用 fade 動畫）
            this.navigate(previousPage, {
                replace: true,
                skipAnimation: false
            });
            // 再次移除，因為 navigate 會添加
            this.history.pop();
        } else {
            // 如果沒有歷史記錄，返回首頁
            this.navigate('pages/home.html', { replace: true });
        }
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

    /**
     * 註冊全域組件引用和組件管理器
     * @param {object} components - 組件對象 { settingPanel, calculator }
     * @param {object} componentsManager - 組件管理器 { createComponent, getComponent }
     */
    registerGlobalComponents(components, componentsManager = null) {
        
        this.globalComponents = components;
        this.componentsManager = componentsManager;
        console.log('✓ Global components registered to router');
    }

    /**
     * 獲取全域組件
     * @param {string} name - 組件名稱
     */
    getGlobalComponent(name) {
        const component = this.globalComponents[name];
        if (!component) {
            console.warn(`Component "${name}" not found`);
        }
        return component || null;
    }

    /**
     * 預載入所有頁面（啟動時一次性載入）
     */
    async preloadAllPages() {
        console.log('📦 Preloading all pages...');

        try {
            // 並行 fetch 所有頁面 HTML
            const htmlPromises = PAGES.map(async (page) => {
                const response = await fetch(page.html);
                if (!response.ok) throw new Error(`Failed to fetch ${page.html}`);
                return {
                    url: page.html,
                    html: await response.text()
                };
            });

            const htmlResults = await Promise.all(htmlPromises);

            // 儲存到 pageCache 並快取頁面配置
            htmlResults.forEach(({ url, html }) => {
                this.pageCache[url] = html;

                // 快取頁面配置
                const pageConfig = PAGES.find(p => p.html === url);
                if (pageConfig) {
                    this.pageConfigs[url] = pageConfig;
                }

                console.log('  ✓ HTML cached:', url);
            });

            // 並行 import 所有頁面 JS 模組
            const modulePromises = PAGES.map(async (page) => {
                if (!page.js) return null;

                const module = await import('/' + page.js);
                return {
                    url: page.html,  // 使用 html 路徑作為 key
                    module
                };
            });

            const moduleResults = await Promise.all(modulePromises);

            // 儲存到 pageModules
            moduleResults.forEach((result) => {
                if (result) {
                    this.pageModules[result.url] = result.module;
                    console.log('  ✓ Module cached:', result.url);
                }
            });

            console.log('✓ All pages preloaded successfully');
            console.log(`  - ${Object.keys(this.pageCache).length} HTML templates`);
            console.log(`  - ${Object.keys(this.pageModules).length} JS modules`);

        } catch (error) {
            console.error('Failed to preload pages:', error);
            throw error;
        }
    }

    /**
     * 清除指定頁面的快取（開發用，生產環境不應使用）
     * @param {string} url - 頁面 URL，不傳則清除所有快取
     */
    clearCache(url = null) {
        if (url) {
            delete this.pageCache[url];
            delete this.pageModules[url];
            delete this.pageInstances[url];
            delete this.pageConfigs[url];
            console.log('✓ Cache cleared for:', url);
        } else {
            this.pageCache = {};
            this.pageModules = {};
            this.pageInstances = {};
            this.pageConfigs = {};
            console.log('✓ All cache cleared');
        }
    }
}
