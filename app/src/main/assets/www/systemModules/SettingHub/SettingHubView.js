import ShopPage from '../moduleShop/ShopPage.js';

export default class SettingHubView {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.containerChecked = false;

        // 保留原先配置，僅修改 methodName 以便觸發對應功能
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
                description: "管理已安裝模組的設置和偏好選項。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "openModuleSettings" // 修改此處
                },
            },
            {
                name: "模組商店",
                description: "瀏覽和下載安裝官方商店模組。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHub",
                    methodName: "openModuleShop" // 修改此處
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
        this.bridge = Agent.bridge; // 取得 Bridge 實例
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
                this.optionsGenerator();
            }
        });
    }

    /**
     * 處理選項點擊事件
     */
    async optionsHandler(data) {
        this.logger.debug(`Option handler called: ${data.methodName}`);
        
        switch (data.methodName) {
            case 'openModuleShop':
                await this.renderModuleShop();
                break;
            case 'openModuleSettings':
                await this.renderModuleSettings();
                break;
            default:
                this.Agent.bridge.showToast('此功能尚未開放或正在開發中');
                break;
        }
    }

    /**
     * 功能：載入並顯示模組商店
     */
    async renderModuleShop() {
        const contentContainer = this.container.querySelector('#setting-main');
        contentContainer.innerHTML = '<div class="loading">正在載入商店...</div>';
        this.updateHeader('模組商店', true);

        try {
            // 載入 HTML 模板 (需確保 Bridge 支援 fetchSystemModules)
            const html = await this.bridge.fetchSystemModules('moduleShop/ShopPage.html');
            if (html) {
                contentContainer.innerHTML = html;
                
                // 初始化商店邏輯
                const shopPage = new ShopPage();
                
                // 傳遞 Agent 環境，並確保 myDOM 指向當前容器
                const shopInterface = {
                    ...this.Agent,
                    myDOM: contentContainer,
                    // 模擬 systemRadio 的掛載事件，立即觸發刷新
                    systemRadio: {
                        myDOM_onMount: (cb) => cb() 
                    }
                };

                await shopPage.init(shopInterface);
            } else {
                throw new Error("無法讀取商店頁面模板");
            }
        } catch (e) {
            this.logger.error(`Failed to load shop: ${e}`);
            contentContainer.innerHTML = `<div class="error">載入失敗: ${e.message}</div>`;
        }
    }

    /**
     * 功能：載入並顯示模組設置 (啟用/停用)
     */
    async renderModuleSettings() {
        const contentContainer = this.container.querySelector('#setting-main');
        contentContainer.innerHTML = '<div class="loading">讀取模組清單...</div>';
        this.updateHeader('模組設置', true);

        try {
            // 獲取系統模組清單 (包含 isEnabled 狀態)
            const modules = await this.bridge.getSystemModulesList();
            
            contentContainer.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'setting-list';

            if (!modules || modules.length === 0) {
                list.innerHTML = '<div class="empty">目前沒有安裝任何模組</div>';
            } else {
                modules.forEach(mod => {
                    const item = document.createElement('div');
                    item.className = 'setting-item module-item';
                    
                    // 檢查啟用狀態，若無此欄位則預設為 true
                    const isEnabled = mod.isEnabled !== false; 

                    item.innerHTML = `
                        <div class="setting-info">
                            <h3>${mod.name} <span class="version">v${mod.version}</span></h3>
                            <p>${mod.description || '無描述'}</p>
                            <span class="meta-tag">${mod.sourceType === 'system' ? '系統內建' : '使用者安裝'}</span>
                        </div>
                        <div class="setting-action">
                            <label class="switch">
                                <input type="checkbox" ${isEnabled ? 'checked' : ''} data-id="${mod.id}">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    `;
                    
                    // 綁定切換事件
                    const toggle = item.querySelector('input');
                    toggle.addEventListener('change', (e) => {
                        this.handleModuleToggle(mod.id, e.target.checked);
                    });

                    list.appendChild(item);
                });
            }
            contentContainer.appendChild(list);

        } catch (e) {
            this.logger.error(`Failed to load settings: ${e}`);
            contentContainer.innerHTML = `<div class="error">讀取失敗: ${e.message}</div>`;
        }
    }

    /**
     * 處理模組啟用/停用
     */
    async handleModuleToggle(moduleId, enable) {
        try {
            // 呼叫 Android 端更新資料庫狀態
            await this.bridge.callAsync('SYS:toggleModule', { id: moduleId, enable: enable });
            this.bridge.showToast(enable ? '模組已啟用 (重啟後生效)' : '模組已停用 (重啟後生效)');
        } catch (e) {
            this.logger.error(`Toggle failed: ${e}`);
            this.bridge.showToast('設定失敗，請重試');
            // 失敗時重新載入清單以回復 UI 狀態
            this.renderModuleSettings();
        }
    }

    updateHeader(title, showBack) {
        const headerTitle = this.container.querySelector('.sys-label-header-title');
        if (headerTitle) headerTitle.textContent = title;

        const backBtn = this.container.querySelector('#back-btn');
        if (backBtn) {
            // 複製按鈕以移除舊的事件監聽器
            const newBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBtn, backBtn);
            
            if (showBack) {
                newBtn.disabled = false;
                newBtn.classList.remove('disabled');
                newBtn.onclick = () => this.restoreMainMenu();
            } else {
                newBtn.disabled = true;
                newBtn.classList.add('disabled');
            }
        }
    }

    restoreMainMenu() {
        this.optionsGenerator(); // 重新渲染主選單
        this.updateHeader('設定集成面板', false);
    }

    optionsGenerator() {
        const contentContainer = this.container.querySelector('#setting-main');
        contentContainer.innerHTML = ''; // 清空內容

        this.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'setting-option-btn';
            btn.textContent = option.name;

            // 設置 dataset 供 click handler 使用
            if (option.handler) {
                btn.dataset.moduleId = option.handler.moduleID;
                btn.dataset.componentName = option.handler.componentName;
                btn.dataset.methodName = option.handler.methodName;
            }

            contentContainer.appendChild(btn);
        });

        // 重新綁定事件
        contentContainer.onclick = (e) => {
            if (e.target.classList.contains('setting-option-btn')) {
                const { moduleId, componentName, methodName } = e.target.dataset;
                this.optionsHandler({
                    moduleID: moduleId,
                    componentName: componentName,
                    methodName: methodName
                });
            }
        };
    }
}