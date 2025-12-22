import ShopPage from '../moduleShop/ShopPage.js';

export default class SettingHubView {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.containerChecked = false;
        this.bridge = null;
        this.pageID = "SettingHub"; // 這是我們在 Router 註冊的 ID

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
        // 初始化授權
        this.eventPlatform.on("authorizeSettingHub_options", (data) => {
            if (!data.dom) return;
            this.container = data.dom;
            this.containerChecked = true;
            // 第一次載入時渲染
            this.renderMainMenu();
        });

        // [強力修復] 導航重置機制
        // 無論之前在什麼狀態，只要 Router 說「現在去 SettingHub」，我們就重置回主選單
        this.eventPlatform.on('Router:Finish_navigate', (targetPageID) => {
            // 寬鬆比對 ID，確保抓到導航事件
            if (targetPageID && targetPageID.includes(this.pageID)) {
                this.logger.debug('SettingHub accessed: Force resetting to Main Menu.');
                this.renderMainMenu();
            }
        });
    }

    async optionsHandler(data) {
        switch (data.methodName) {
            case 'openModuleShop': await this.openModuleShop(); break;
            case 'openModuleSettings': await this.openModuleSettings(); break;
            case 'theme': this.bridge.showToast('功能開發中...'); break;
            default: this.bridge.showToast('此功能尚未開放'); break;
        }
    }

    // 渲染主選單 (列表模式)
    renderMainMenu() {
        if (!this.container) return;
        const contentContainer = this.container.querySelector('#setting-main');
        if (!contentContainer) return;

        // 強制清空內容
        contentContainer.innerHTML = '';
        contentContainer.className = 'setting-main'; 

        const list = document.createElement('div');
        list.className = 'setting-list'; // 這是列表容器

        this.options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'setting-item';
            
            // 點擊整條觸發
            item.onclick = () => {
                if (option.handler) this.optionsHandler(option.handler);
            };

            item.innerHTML = `
                <div class="setting-info">
                    <h3>${option.name}</h3>
                    <p>${option.description}</p>
                </div>
            `;
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
                newBtn.classList.remove('disabled');
                newBtn.style.display = 'flex'; // 確保顯示
                newBtn.onclick = () => this.renderMainMenu(); // 點擊返回
            } else {
                newBtn.disabled = true;
                newBtn.classList.add('disabled');
                // newBtn.style.display = 'none'; // 視需求決定是否隱藏
            }
        }
    }

    // --- 模組商店 ---
    async openModuleShop() {
        const contentContainer = this.container.querySelector('#setting-main');
        contentContainer.innerHTML = '<div class="loading">載入商店中...</div>';
        this.updateHeader('模組商店', true);
        
        try {
            const htmlContent = await this.bridge.fetchSystemModules('moduleShop/ShopPage.html', 'text');
            if (!htmlContent) throw new Error('無法載入商店介面');
            contentContainer.innerHTML = htmlContent;
            const shopPage = new ShopPage();
            await shopPage.init({
                ...this.Agent,
                myDOM: contentContainer, 
                systemRadio: { myDOM_onMount: (cb) => cb() }
            });
        } catch (e) {
            this.logger.error(e);
            contentContainer.innerHTML = `<div class="error">載入失敗: ${e.message}</div>`;
        }
    }

    // --- 模組設置 ---
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
                            <h3>${mod.name} <span style="font-size:0.8em;color:#aaa">v${mod.version}</span></h3>
                            <p>${mod.description || '無描述'}</p>
                        </div>
                        <div class="setting-action">
                            <label class="switch">
                                <input type="checkbox" data-id="${mod.id}" ${isEnabled ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                    `;
                    
                    // 阻止點擊整條觸發開關
                    item.onclick = (e) => e.stopPropagation();

                    item.querySelector('input').addEventListener('change', (e) => {
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
        try {
            await this.bridge.callAsync('SYS:toggleModule', { id: moduleId, enable: enable });
            this.bridge.showToast(enable ? '模組已啟用 (重啟生效)' : '模組已停用 (重啟生效)');
        } catch (e) {
            this.bridge.showToast('設定失敗');
            await this.openModuleSettings();
        }
    }
}