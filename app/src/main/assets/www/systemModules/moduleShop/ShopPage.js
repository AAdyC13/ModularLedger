import { Bridge } from '../../js/bridge.js';

export default class ShopPage {
    constructor() {
        // 初始化 Bridge
        this.bridge = new Bridge({
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error
        });
        
        this.serverUrl = 'http://163.18.26.227:3001'; 
        this.dom = null; // 儲存 Shadow DOM 根節點
        this.logger = console;
    }

    /**
     * Component 標準初始化接口
     * @param {Object} agentInterface - 包含 myDOM, tools, eventPlatform 等
     */
    async init(agentInterface) {
        // 取得 Shadow DOM (關鍵：必須透過此物件操作 HTML)
        this.dom = agentInterface.myDOM;
        this.logger = agentInterface.tools.logger || console;

        if (!this.dom) {
            this.logger.error('[Shop] Error: Shadow DOM not available. Check tech.json type is "Panel".');
            return false;
        }

        // 監聽 DOM 掛載事件 (相當於 onShow)，確保每次進入頁面都重新整理
        agentInterface.systemRadio.myDOM_onMount(() => {
            this.logger.debug('[Shop] Page mounted, refreshing list...');
            this.fetchAndRenderModules();
        });

        // 首次載入
        this.renderLoading();
        await this.fetchAndRenderModules();
        
        return true;
    }

    renderLoading() {
        if (!this.dom) return;
        // 使用 this.dom.querySelector 搜尋 Shadow DOM 內的元素
        const container = this.dom.querySelector('#shop-container');
        if (container) {
            container.innerHTML = '<div class="shop-loading">正在載入模組商店...</div>';
        } else {
            this.logger.warn('[Shop] Container #shop-container not found in Shadow DOM');
        }
    }

    async fetchAndRenderModules() {
        if (!this.dom) return;
        try {
            const apiUrl = `${this.serverUrl}/api/modules`;
            this.logger.debug(`[Shop] Fetching modules from: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            
            if (result.success) {
                this.renderList(result.data);
            } else {
                this.renderError(result.message || '伺服器發生錯誤');
            }
        } catch (error) {
            this.logger.error(`[Shop] Fetch error: ${error}`);
            this.renderError('無法連接至商店伺服器，請檢查網路設定。');
        }
    }

    renderError(msg) {
        if (!this.dom) return;
        const container = this.dom.querySelector('#shop-container');
        if (container) {
            container.innerHTML = `
                <div class="shop-error">
                    <p>${msg}</p>
                    <button id="retry-btn">重試</button>
                </div>
            `;
            // 綁定 Shadow DOM 內的按鈕
            const retryBtn = container.querySelector('#retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    this.renderLoading();
                    this.fetchAndRenderModules();
                });
            }
        }
    }

    renderList(modules) {
        if (!this.dom) return;
        const container = this.dom.querySelector('#shop-container');
        if (!container) return;

        container.innerHTML = '';
        
        if (!modules || modules.length === 0) {
            container.innerHTML = '<div class="shop-empty">目前沒有可用的模組</div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'module-list';

        modules.forEach(mod => {
            const card = document.createElement('div');
            card.className = 'module-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3>${mod.name}</h3>
                    <span class="version">v${mod.version}</span>
                </div>
                <p class="desc">${mod.description || '無描述'}</p>
                <div class="meta">
                    <span>作者: ${mod.author}</span>
                </div>
                <button class="btn-install" data-url="${mod.downloadUrl}">下載並安裝</button>
            `;
            
            // 直接在這裡綁定事件，避免 querySelectorAll 的複雜性
            const btn = card.querySelector('.btn-install');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    this.handleInstall(mod.downloadUrl, e.target);
                });
            }

            list.appendChild(card);
        });

        container.appendChild(list);
    }

    async handleInstall(downloadUrl, btnElement) {
        if (!downloadUrl) return;

        const originalText = btnElement.innerText;
        btnElement.disabled = true;
        btnElement.innerText = '下載中...';
        this.bridge.showToast('開始下載模組...');

        try {
            // 呼叫 Android 原生接口
            const result = this.bridge.callSync('installModule', downloadUrl);
            
            if (result && result.success) {
                this.bridge.showToast('安裝成功！');
                btnElement.innerText = '已安裝';
                btnElement.classList.add('installed');
            } else {
                throw new Error(result ? result.message : '未知錯誤');
            }
        } catch (error) {
            this.logger.error(`[Shop] Install failed: ${error}`);
            this.bridge.showToast('安裝失敗: ' + error.message);
            btnElement.disabled = false;
            btnElement.innerText = originalText;
        }
    }
}