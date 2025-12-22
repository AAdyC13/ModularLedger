import ShopPage from '../moduleShop/ShopPage.js';

export default class SettingHubView {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.containerChecked = false;
        this.bridge = null;

        this.options = [
            {
                name: "介面與主題",
                description: "設定應用程式的介面布局和主題顏色選項。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "theme"
                },
            },
            {
                name: "模組設置",
                description: "管理已安裝模組的設置和啟用狀態。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "openModuleSettings"
                },
            },
            {
                name: "模組商店",
                description: "瀏覽和下載安裝官方商店模組。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "openModuleShop"
                },
            },
            {
                name: "語言",
                description: "選擇支持的系統語言。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "language"
                },
            },
            {
                name: "匯入/匯出記帳資料",
                description: "匯入或匯出您的記帳資料以進行備份或轉移。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "backup"
                },
            },
            {
                name: "建議與回饋",
                description: "提供反饋或建議以幫助我們改進應用程式。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "feedback"
                },
            },
            {
                name: "關於本應用程式",
                description: "查看應用程式版本資訊、開發者資訊及相關法律文件。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "about"
                },
            },
        ];
    }

    async init(Agent) {
        this.Agent = Agent;
        this.logger = Agent.tools.logger;
        this.eventPlatform = Agent.eventPlatform;
        this.bridge = Agent.bridge; 
        
        this.setOnEvents();
        this.logger.debug(`SettingHubView initialized`);
        return true;
    }

    setOnEvents() {
        this.eventPlatform.on("authorizeSettingHub_options", (data) => {
            if (!data.dom) {
                this.logger.warn('SettingHub authorize view DOM not provided');
                return;
            }
            if (!this.containerChecked) {
                this.container = data.dom;
                this.containerChecked = true;
                this.renderMainMenu();
            }
        });
    }

    async optionsHandler(data) {
        this.logger.debug(`Option handler called: ${data.methodName}`);
        switch (data.methodName) {
            case 'openModuleShop':
                await this.openModuleShop();
                break;
            case 'openModuleSettings':
                await this.openModuleSettings();
                break;
            case 'theme':
                this.bridge.showToast('功能開發中...');
                break;
            default:
                this.bridge.showToast('此功能尚未開放');
                break;
        }
    }

    renderMainMenu() {
        const contentContainer = this.container.querySelector('#setting-main');
        if (!contentContainer) return;

        contentContainer.innerHTML = '';
        contentContainer.className = 'setting-main'; 

        const list = document.createElement('div');
        list.className = 'setting-list';

        this.options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'setting-item';
            item.innerHTML = `
                <div class="setting-info">
                    <h3>${option.name}</h3>
                    <p>${option.description}</p>
                </div>
                <button class="setting-option-btn">開啟</button>
            `;
            
            const btn = item.querySelector('button');
            // 綁定點擊事件
            if (option.handler) {
                btn.onclick = () => this.optionsHandler(option.handler);
            }

            list.appendChild(item);
        });

        contentContainer.appendChild(list);
        this.updateHeader('設定集成面板', false);
    }

    updateHeader(title, showBack) {
        const headerTitle = this.container.querySelector('.sys-label-header-title');
        if (headerTitle) headerTitle.textContent = title;

        const backBtn = this.container.querySelector('#back-btn');
        if (backBtn) {
            const newBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBtn, backBtn);
            
            if (showBack) {
                newBtn.disabled = false;
                newBtn.onclick = () => this.renderMainMenu();
            } else {
                newBtn.disabled = true;
            }
        }
    }

    // ============================================================
    // 功能：模組商店
    // ============================================================
    async openModuleShop() {
        const contentContainer = this.container.querySelector('#setting-main');
        contentContainer.innerHTML = '<div class="loading">載入商店中...</div>';
        this.updateHeader('模組商店', true);
        
        try {
            // 這裡會使用到 this.bridge，如果 init 沒存好就會報錯
            const htmlContent = await this.bridge.fetchSystemModules('moduleShop/ShopPage.html', 'text');
            if (!htmlContent) throw new Error('無法載入商店介面模板');

            contentContainer.innerHTML = htmlContent;

            const shopPage = new ShopPage();
            const shopInterface = {
                ...this.Agent,
                myDOM: contentContainer, 
                systemRadio: {
                    myDOM_onMount: (cb) => cb() 
                }
            };
            
            await shopPage.init(shopInterface);

        } catch (e) {
            this.logger.error(e);
            contentContainer.innerHTML = `<div class="error">載入失敗: ${e.message}</div>`;
        }
    }

    // ============================================================
    // 功能：模組設置 (啟用/停用)
    // ============================================================
    async openModuleSettings() {
        const contentContainer = this.container.querySelector('#setting-main');
        contentContainer.innerHTML = '<div class="loading">讀取模組清單...</div>';
        this.updateHeader('模組設置', true);

        try {
            const modules = await this.bridge.getSystemModulesList();
            
            contentContainer.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'setting-list';

            if (!modules || modules.length === 0) {
                list.innerHTML = '<div class="empty">無已安裝模組</div>';
            } else {
                modules.forEach(mod => {
                    const item = document.createElement('div');
                    item.className = 'setting-item module-item';
                    const isEnabled = mod.isEnabled !== false; 

                    item.innerHTML = `
                        <div class="setting-info">
                            <h3>${mod.name} <span style="font-size:0.8em;color:#666">v${mod.version}</span></h3>
                            <p>${mod.description || '無描述'}</p>
                            <p style="font-size:0.8em;color:#888">ID: ${mod.id} (${mod.sourceType})</p>
                        </div>
                        <div class="setting-action">
                            <label class="switch">
                                <input type="checkbox" ${isEnabled ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                    `;
                    
                    const toggle = item.querySelector('input');
                    toggle.addEventListener('change', (e) => {
                        this.handleModuleToggle(mod.id, e.target.checked);
                    });

                    list.appendChild(item);
                });
            }
            contentContainer.appendChild(list);

        } catch (e) {
            this.logger.error(e);
            contentContainer.innerHTML = `<div class="error">讀取失敗: ${e.message}</div>`;
        }
    }

    async handleModuleToggle(moduleId, enable) {
        this.logger.debug(`Toggling module ${moduleId} to ${enable}`);
        try {
            await this.bridge.callAsync('SYS:toggleModule', { id: moduleId, enable: enable });
            this.bridge.showToast(enable ? '模組已啟用 (重啟後生效)' : '模組已停用 (重啟後生效)');
        } catch (e) {
            this.logger.error(`Failed to toggle module: ${e.message}`);
            this.bridge.showToast('設定失敗');
            await this.openModuleSettings(); 
        }
    }
}