import ShopPage from '../moduleShop/ShopPage.js';

export default class SettingHubView {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.bridge = null;
        this.pageID = "SettingHub";

        this.options = [
            {
                name: "介面與主題",
                description: "設定應用程式的介面布局和主題顏色。",
                handler: { componentName: "SettingHub", methodName: "theme" }
            },
            {
                name: "模組設置",
                description: "管理已安裝模組的啟用狀態。",
                handler: { componentName: "SettingHub", methodName: "openModuleSettings" }
            },
            {
                name: "模組商店",
                description: "瀏覽和下載安裝官方商店模組。",
                handler: { componentName: "SettingHub", methodName: "openModuleShop" }
            },
            {
                name: "語言",
                description: "選擇支持的系統語言。",
                handler: { componentName: "SettingHub", methodName: "language" }
            },
            {
                name: "匯入/匯出記帳資料",
                description: "匯入或匯出您的記帳資料。",
                handler: { componentName: "SettingHub", methodName: "backup" }
            },
            {
                name: "建議與回饋",
                description: "提供反饋或建議。",
                handler: { componentName: "SettingHub", methodName: "feedback" }
            },
            {
                name: "關於本應用程式",
                description: "版本資訊與相關文件。",
                handler: { componentName: "SettingHub", methodName: "about" }
            }
        ];
    }

    async init(Agent) {
        this.Agent = Agent;
        this.logger = Agent.tools.logger;
        this.eventPlatform = Agent.eventPlatform;
        this.bridge = Agent.bridge;
        this.setOnEvents();
        return true;
    }

    setOnEvents() {
        this.eventPlatform.on("authorizeSettingHub_options", (data) => {
            if (data.dom) {
                this.container = data.dom;
            } else if (!this.container) {
                const main = document.querySelector('#setting-main');
                if (main) this.container = main.parentElement; 
            }

            if (this.container) {
                this.logger.debug("[SettingHub] Resetting to Main Menu.");
                this.renderMainMenu();
            } else {
                this.logger.error("[SettingHub] Container missing.");
            }
        });
    }

    async showToast(message) {
        if (this.bridge && typeof this.bridge.callAsync === 'function') {
            try {
                await this.bridge.callAsync('SYS:showToast', { message: message });
            } catch (e) {
                console.error("Toast error:", e);
            }
        } else {
            console.log("Toast:", message);
        }
    }

    async optionsHandler(data) {
        switch (data.methodName) {
            case 'openModuleShop': await this.openModuleShop(); break;
            case 'openModuleSettings': await this.openModuleSettings(); break;
            case 'theme': this.showToast('功能開發中...'); break;
            default: this.showToast('此功能尚未開放'); break;
        }
    }

    getContentContainer() {
        if (!this.container) return null;
        let target = this.container.querySelector('#setting-main');
        if (!target) {
            if(this.container.id === 'setting-main' || this.container.classList.contains('setting-main')) {
                target = this.container;
            } else {
                target = document.createElement('div');
                target.id = 'setting-main';
                this.container.appendChild(target);
            }
        }
        return target;
    }

    renderMainMenu() {
        const contentContainer = this.getContentContainer();
        if (!contentContainer) return;

        // 重置為灰色背景
        contentContainer.innerHTML = '';
        contentContainer.className = 'setting-main'; 

        const list = document.createElement('div');
        list.className = 'setting-list';

        this.options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'setting-item';
            
            item.onclick = () => {
                if (option.handler) this.optionsHandler(option.handler);
            };

            item.innerHTML = `
                <div class="setting-info">
                    <h3>${option.name}</h3>
                    <p>${option.description}</p>
                </div>
                <div class="arrow-icon">›</div>
            `;
            list.appendChild(item);
        });

        contentContainer.appendChild(list);
        this.updateHeader('設定集成面板', false);
    }

    updateHeader(title, showBack) {
        const headerTitle = document.querySelector('.sys-label-header-title');
        if (headerTitle) headerTitle.textContent = title;

        const backBtn = document.querySelector('#back-btn');
        if (backBtn) {
            const newBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBtn, backBtn);
            
            newBtn.disabled = false;
            newBtn.classList.remove('disabled');
            newBtn.style.display = 'flex';

            if (showBack) {
                newBtn.onclick = () => this.renderMainMenu(); 
            } else {
                newBtn.onclick = () => {
                     this.Agent.eventPlatform.emit('Router:Navigate', { pageID: 'systemPage.Home' });
                };
            }
        }
    }

    async openModuleShop() {
        const contentContainer = this.getContentContainer();
        if(!contentContainer) return;

        contentContainer.innerHTML = '<div class="status-msg">正在載入模組商店...</div>';
        this.updateHeader('模組商店', true);
        
        try {
            const htmlContent = await this.bridge.fetchSystemModules('moduleShop/ShopPage.html', 'text');
            contentContainer.innerHTML = htmlContent || ''; 
            
            const shopPage = new ShopPage();
            await shopPage.init({
                ...this.Agent,
                myDOM: contentContainer, 
                systemRadio: { myDOM_onMount: (cb) => cb() }
            });
        } catch (e) {
            this.logger.error(e);
            contentContainer.innerHTML = `<div class="status-msg error-msg">載入失敗: ${e.message}</div>`;
        }
    }

    async openModuleSettings() {
        const contentContainer = this.getContentContainer();
        if(!contentContainer) return;

        contentContainer.innerHTML = '<div class="status-msg">讀取模組清單...</div>';
        this.updateHeader('模組設置', true);

        try {
            const modules = await this.bridge.getSystemModulesList();
            contentContainer.innerHTML = '';
            
            const list = document.createElement('div');
            list.className = 'setting-list';

            if (!modules || modules.length === 0) {
                contentContainer.innerHTML = '<div class="status-msg">無已安裝模組</div>';
            } else {
                modules.forEach(mod => {
                    const item = document.createElement('div');
                    item.className = 'setting-item'; 
                    const isEnabled = mod.isEnabled !== false; 

                    item.innerHTML = `
                        <div class="setting-info">
                            <h3>${mod.name} <span class="version-tag">v${mod.version}</span></h3>
                            <p>${mod.description || '無描述'}</p>
                        </div>
                        <div class="setting-action">
                            <label class="switch">
                                <input type="checkbox" data-id="${mod.id}" ${isEnabled ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                    `;
                    
                    item.onclick = (e) => e.stopPropagation();

                    item.querySelector('input').addEventListener('change', (e) => {
                        this.handleModuleToggle(mod.id, e.target.checked);
                    });

                    list.appendChild(item);
                });
                contentContainer.appendChild(list);
            }

        } catch (e) {
            this.logger.error(e);
            contentContainer.innerHTML = `<div class="status-msg error-msg">讀取失敗: ${e.message}</div>`;
        }
    }

    async handleModuleToggle(moduleId, enable) {
        try {
            await this.bridge.callAsync('SYS:toggleModule', { id: moduleId, enable: enable });
            this.showToast(enable ? '模組已啟用 (重啟生效)' : '模組已停用 (重啟生效)');
        } catch (e) {
            this.showToast('設定失敗');
            await this.openModuleSettings();
        }
    }
}