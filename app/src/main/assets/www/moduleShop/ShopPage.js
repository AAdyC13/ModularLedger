import { BasePage } from '../pages/BasePage.js';
import { Bridge } from '../js/bridge.js';

export class ShopPage extends BasePage {
    constructor(router) {
        super(router);
        // 初始化 Bridge，用於呼叫原生下載
        this.bridge = new Bridge({
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error
        });
        
        // 設定伺服器位址
        this.serverUrl = 'http://163.18.26.227:3000'; 
    }

    async init() {
        super.init();
        this.renderLoading();
        await this.fetchAndRenderModules();
    }

    async rebind() {
        super.rebind();
        // 頁面從快取恢復時，重新綁定事件
        this.bindEvents();
    }

    renderLoading() {
        const container = document.getElementById('shop-container');
        if (container) {
            container.innerHTML = '<div class="shop-loading">正在載入模組商店...</div>';
        }
    }

    async fetchAndRenderModules() {
        try {
            const apiUrl = `${this.serverUrl}/api/modules`;
            console.log(`[Shop] Fetching modules from: ${apiUrl}`);

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
            console.error('[Shop] Fetch error:', error);
            this.renderError('無法連接至商店伺服器，請檢查網路設定。');
        }
    }

    renderError(msg) {
        const container = document.getElementById('shop-container');
        if (container) {
            container.innerHTML = `
                <div class="shop-error">
                    <p>${msg}</p>
                    <button id="retry-btn">重試</button>
                </div>
            `;
            this.addEventListener(document.getElementById('retry-btn'), 'click', () => {
                this.renderLoading();
                this.fetchAndRenderModules();
            });
        }
    }

    renderList(modules) {
        const container = document.getElementById('shop-container');
        if (!container) return;

        container.innerHTML = '';
        
        if (modules.length === 0) {
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
            list.appendChild(card);
        });

        container.appendChild(list);
        this.bindEvents();
    }

    bindEvents() {
        // 綁定所有安裝按鈕
        const buttons = document.querySelectorAll('.btn-install');
        buttons.forEach(btn => {
            // 防止重複綁定 (rebind 時可能發生)
            if(btn.dataset.bound) return;
            
            this.addEventListener(btn, 'click', (e) => {
                const url = e.target.dataset.url;
                this.handleInstall(url, e.target);
            });
            btn.dataset.bound = "true";
        });
    }

    async handleInstall(downloadUrl, btnElement) {
        if (!downloadUrl) return;

        // UI 鎖定
        const originalText = btnElement.innerText;
        btnElement.disabled = true;
        btnElement.innerText = '下載中...';
        this.bridge.showToast('開始下載模組...');

        try {
            // 呼叫 Android 原生接口
            // 注意：請確保 Interface.kt 已修正為背景執行，否則這裡會卡住
            const result = this.bridge.callSync('installModule', downloadUrl);
            
            if (result && result.success) {
                this.bridge.showToast('安裝成功！');
                btnElement.innerText = '已安裝';
                btnElement.classList.add('installed');
            } else {
                throw new Error(result ? result.message : '未知錯誤');
            }
        } catch (error) {
            console.error('[Shop] Install failed:', error);
            this.bridge.showToast('安裝失敗: ' + error.message);
            btnElement.disabled = false;
            btnElement.innerText = originalText;
        }
    }
}