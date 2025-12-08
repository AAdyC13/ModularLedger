/**
 * Router - 頁面路由管理器
 */
export class Router {
    constructor(logger, eventAgent) {
        this.logger = logger;
        this.eventAgent = eventAgent;
        this.currentPage = null;
        this.pageCaches = {}; // 頁面快取
    }

    init() {

        this.eventAgent.on('PM:Finish_preloade_page', this.addPageToCache.bind(this));

        this.eventAgent.on('PM:Del_preloade_page', (PEid) => {
            delete this.pageCaches[PEid];
            this.logger.debug(`Page deleted from cache: [${PEid}]`);
        });
        this.eventAgent.on('RT::Index_page_is', this.indexPageIs.bind(this));
        this.eventAgent.on('EM:navigate', this.proxyNavigate.bind(this));

    }
    async proxyNavigate(data) {
        await this.navigate(data.pageID, data.options);
    }
    addPageToCache(PE) {
        // this.logger.debug(`Adding page to cache: ${PE.id}`);
        if (!PE || !PE.id) {
            this.logger.error('Invalid pageID or pageElement for caching');
            return;
        }
        this.pageCaches[PE.id] = PE.getRoot();
        this.logger.debug(`Page added to cache: [${PE.id}]`);
    }
    indexPageIs(pageID) {
        this.indexPage = pageID;
        this.logger.debug(`Index page set to: ${this.indexPage}`);
    }

    /**
     * 導航到指定頁面
     * @param {string} pageID - 頁面 ID
     * @param {object} options - 換頁選項
     */
    async navigate(pageID, options = {}) {
        try {
            // 獲取應用容器
            const app = document.getElementById('app');
            if (!app) {
                throw new Error('App container not found');
            }

            // const animation = options.animation; // undefined = 預設 fade

            // 1. 執行離開動畫（如果不是首次載入）
            // if (this.currentPage && !options.skipAnimation) {
            //     await this.executeExitAnimation(app, animation);
            // }

            // 2. 從快取讀取頁面 HTML（永遠不 fetch），如果沒有則等待最多1秒
            let next_page = this.pageCaches[pageID];
            if (!next_page) {
                try {
                    this.logger.debug(`Page not in cache, waiting to load: ${pageID}`);
                    next_page = await this.waitForPage(pageID);
                } catch (err) {
                    // 警告! router.pageCaches沒有這一頁，不進行導航，未來可新增alrt告知用戶
                    this.logger.error(`Page not preloaded, cannot navigate: ${pageID}`);
                    return;
                }
            }
            this.logger.debug(`Loaded page from cache: ${pageID}`);

            // 3. 處理當前頁面實例（）
            if (this.currentPage) {
            }

            // 4. 更新 DOM
            app.replaceChildren(next_page);
            this.eventAgent.emit('Router:Finish_navigate', pageID, {});

            // 6. 記錄當前頁面（WebView 環境不需要修改 URL）
            this.currentPage = next_page;


            // 8. 執行進入動畫
            // if (!options.skipAnimation) {
            //     await this.executeEnterAnimation(app, animation);
            // }

        } catch (error) {
            this.handleError(error, pageID);
        }
    }

    /**
     * 等待頁面載入到快取，最多等待1秒
     * @param {string} pageID - 頁面 ID
     * @returns {Promise<HTMLElement>} 頁面元素
     */
    waitForPage(pageID) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (this.pageCaches[pageID]) {
                    clearInterval(interval);
                    resolve(this.pageCaches[pageID]);
                } else if (Date.now() - startTime > 1000) {
                    clearInterval(interval);
                    reject(new Error(`Page not preloaded within 1 second: ${pageID}`));
                }
            }, 50); // 每50ms檢查一次
        });
    }

    async start() {
        this.eventAgent.emit('Router:Starting', this.indexPage, {});
        await this.eventAgent.callMeBack();

        this.logger.debug(`Starting navigation to index page: ${this.indexPage}`);
        this.navigate(this.indexPage, {});
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
     * 錯誤處理
     * @param {Error} error - 錯誤對象
     * @param {string} url - 出錯的 URL
     */
    handleError(error, url) {
        this.logger.error(`Routing error: ${error}`);

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
}