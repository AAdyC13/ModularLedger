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
        this.bridge = agentInterface.bridge || new Bridge(this.logger);

        if (!this.dom) return false;

        if (agentInterface.systemRadio && agentInterface.systemRadio.myDOM_onMount) {
            agentInterface.systemRadio.myDOM_onMount(() => {
                this.fetchAndRenderModules();
            });
        }

        await this.fetchAndRenderModules();
        return true;
    }

    async showToast(msg) {
        if(this.bridge && this.bridge.callAsync) {
            try { await this.bridge.callAsync('SYS:showToast', {message: msg}); } catch(e){}
        } else {
            console.log("Toast:", msg);
        }
    }

    async fetchAndRenderModules() {
        const container = this.dom.querySelector('#shop-container') || this.dom;
        // 檢查是否已有內容，避免重複
        if (!container.querySelector('.module-list-container')) {
             container.innerHTML = '<div class="status-msg">正在載入模組商店...</div>';
        }

        try {
            const apiUrl = `${this.serverUrl}/api/modules`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            const result = await response.json();
            
            if (result.success) {
                this.renderList(container, result.data);
            } else {
                this.renderError(container, result.message || '無法取得資料');
            }
        } catch (error) {
            this.logger.error(`[Shop] Error: ${error}`);
            let msg = '無法連接至商店伺服器';
            if (window.location.protocol === 'https:' && this.serverUrl.startsWith('http:')) {
                msg += '<br><small>(請檢查網路或 App 安全設定)</small>';
            }
            this.renderError(container, msg);
        }
    }

    renderError(container, msg) {
        container.innerHTML = `
            <div class="status-msg error-msg">
                <p>${msg}</p>
                <button class="action-btn" id="retry-btn" style="margin-top:15px; border-color:#999; color:#666;">重試</button>
            </div>
        `;
        const btn = container.querySelector('#retry-btn');
        if(btn) btn.onclick = () => this.fetchAndRenderModules();
    }

    renderList(container, modules) {
        container.innerHTML = '';
        
        if (!modules || modules.length === 0) {
            container.innerHTML = '<div class="status-msg">目前沒有可用的模組</div>';
            return;
        }

        const listDiv = document.createElement('div');
        listDiv.className = 'module-list-container';

        modules.forEach(mod => {
            const item = document.createElement('div');
            item.className = 'shop-item'; 
            
            item.innerHTML = `
                <div class="shop-info">
                    <h3>
                        ${mod.name} 
                        <span class="version-tag">v${mod.version}</span>
                    </h3>
                    <p>${mod.description || '暫無描述'}</p>
                </div>
                <button class="action-btn" data-url="${mod.downloadUrl}">取得</button>
            `;
            
            const btn = item.querySelector('.action-btn');
            btn.onclick = (e) => {
                e.stopPropagation();
                this.handleInstall(mod.downloadUrl, e.target);
            };

            listDiv.appendChild(item);
        });

        container.appendChild(listDiv);
    }

    async handleInstall(downloadUrl, btnElement) {
        if (!this.bridge) return;
        
        const originalText = btnElement.innerText;
        btnElement.disabled = true;
        btnElement.innerText = '下載中';
        
        try {
            const result = await this.bridge.callAsync('SYS:installModule', { url: downloadUrl }, 30000);
            
            if (result === true) {
                this.showToast('安裝成功');
                btnElement.innerText = '已安裝';
                btnElement.classList.add('installed');
            } else {
                throw new Error('Install failed');
            }
        } catch (error) {
            this.showToast('安裝失敗');
            btnElement.disabled = false;
            btnElement.innerText = originalText;
        }
    }
}