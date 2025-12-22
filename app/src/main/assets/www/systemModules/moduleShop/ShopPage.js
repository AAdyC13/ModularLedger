import { Bridge } from '../../js/bridge.js';

export default class ShopPage {
    constructor() {
        this.serverUrl = 'http://163.18.26.227:3001'; 
        this.dom = null; 
        this.logger = console;
        this.bridge = null;
    }

    async init(agentInterface) {
        this.dom = agentInterface.myDOM;
        this.logger = agentInterface.tools.logger || console;
        
        // 1. 優先使用從 SettingHubView 傳遞下來的 bridge，若無則降級建立新實例
        // 這是關鍵修正：確保與 ComponentManager 傳遞的 bridge 一致
        this.bridge = agentInterface.bridge || new Bridge(this.logger);

        if (!this.dom) {
            this.logger.error('[Shop] Error: DOM not available.');
            return false;
        }

        // 處理掛載事件
        if (agentInterface.systemRadio && agentInterface.systemRadio.myDOM_onMount) {
            agentInterface.systemRadio.myDOM_onMount(() => {
                this.fetchAndRenderModules();
            });
        }

        this.renderLoading();
        await this.fetchAndRenderModules();
        
        return true;
    }

    renderLoading() {
        if (!this.dom) return;
        const container = this.dom.querySelector('#shop-container');
        if (container) {
            container.innerHTML = '<div class="shop-loading">正在載入模組商店...</div>';
        }
    }

    async fetchAndRenderModules() {
        if (!this.dom) return;
        try {
            const apiUrl = `${this.serverUrl}/api/modules`;
            this.logger.debug(`[Shop] Fetching: ${apiUrl}`);

            // 使用 fetch API 獲取清單
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            
            if (result.success) {
                this.renderList(result.data);
            } else {
                this.renderError(result.message || '伺服器發生錯誤');
            }
        } catch (error) {
            this.logger.error(`[Shop] Error: ${error}`);
            this.renderError('無法連接至商店伺服器。');
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
        
        // 確保 bridge 存在再呼叫 showToast
        if (this.bridge) {
            this.bridge.showToast('開始下載模組...');
        } else {
            console.warn('[Shop] Bridge not initialized');
        }

        try {
            // 2. 呼叫 Bridge 的異步方法執行原生下載與安裝邏輯
            // 這邊使用了 callAsync，它是我們之前在 bridge.js 中新增的方法
            if (!this.bridge) throw new Error('Bridge is not initialized');

            const result = await this.bridge.callAsync('SYS:installModule', { url: downloadUrl }, 30000); // 設定 30秒 timeout 以防下載過久
            
            if (result === true) {
                this.bridge.showToast('安裝成功！請至模組設置啟用。');
                btnElement.innerText = '已安裝';
                btnElement.classList.add('installed');
            } else {
                throw new Error('安裝過程回傳失敗');
            }
        } catch (error) {
            this.logger.error(`[Shop] Install failed: ${error}`);
            if (this.bridge) {
                this.bridge.showToast('安裝失敗: ' + (error.message || '未知錯誤'));
            }
            btnElement.disabled = false;
            btnElement.innerText = originalText;
        }
    }
}