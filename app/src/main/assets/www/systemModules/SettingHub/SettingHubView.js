export default class SettingHubView {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.containerChecked = false;
        this.logger = null;
        this.callUI = null;
        this.systemInterface = null;
        this.packageComponents = null;

        this.options = [
            {
                name: "介面與主題",
                description: "設定應用程式的介面布局和主題顏色選項。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "",
                    methodName: "",
                    payload: {}
                },
            },
            {
                name: "模組設置",
                description: "管理已安裝模組的設置和偏好選項。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "",
                    methodName: "",
                    payload: {}
                },
            },
            {
                name: "模組商店",
                description: "瀏覽和下載安裝官方商店模組。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "",
                    methodName: "",
                    payload: {}
                },
            },
            {
                name: "語言",
                description: "選擇支持的系統語言。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "",
                    methodName: "",
                    payload: {}
                },
            },

            {
                name: "匯入/匯出記帳資料",
                description: "匯入或匯出您的記帳資料以進行備份或轉移。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "",
                    methodName: "",
                    payload: {}
                },
            },
            {
                name: "建議與回饋",
                description: "提供反饋或建議以幫助我們改進應用程式。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHubView",
                    methodName: "AdjustLayout"
                },
            },
            {
                name: "關於本應用程式",
                description: "查看應用程式版本資訊、開發者資訊及相關法律文件。",
                handler: {
                    moduleID: "systemModule.SettingHubView",
                    componentName: "SettingHubView",
                    methodName: "AboutApp"

                },
            },
        ];
    }

    async init(Agent) {
        this.Agent = Agent;
        this.logger = Agent.tools.logger;
        this.callUI = Agent.tools.callUI;
        this.systemInterface = Agent.tools.systemInterface;
        this.packageComponents = Agent.packageComponents;
        this.eventPlatform = Agent.eventPlatform;
        this.setOnEvents();
        this.logger.debug(`Recorder initialized`);
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
    async optionsHandler(data) {
        // data = {
        //     moduleID: "something",
        //     componentName: "something",
        //     methodName: "something",
        //     payload: { ... }
        // }
        const { moduleID, componentName, methodName, payload } = data;
        if (moduleID === "systemModule.SettingHubView") {
            if (componentName === "SettingHubView") {
                switch (methodName) {
                    case "AdjustLayout":
                        this.callUI["AdjustLayout"]();
                        break;
                    case "AboutApp":
                        this.callUI["AboutApp"]();
                        break;
                    default:
                        this.logger.warn(`SettingHubView: Unknown this.methodName: ${methodName}`);
                        break;
                }
            } else {
                try { await this.packageComponents[componentName][methodName](payload); }
                catch (error) {
                    this.logger.error(`Error calling method ${methodName} on component ${componentName}: ${error}`);
                }
            }
        }

    }
    optionsGenerator() {
        const contentContainer = this.container.querySelector('#setting-main');

        contentContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('setting-option-btn')) {
                const { moduleId, componentName, methodName } = e.target.dataset;
                await this.optionsHandler({
                    moduleID: moduleId,
                    componentName: componentName,
                    methodName: methodName,
                    payload: e.target.dataset.payload ? JSON.parse(e.target.dataset.payload) : {}
                });
            }
        });

        this.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'setting-option-btn';
            btn.textContent = option.name;

            if (option.handler) {
                btn.dataset.moduleId = option.handler.moduleID;
                btn.dataset.componentName = option.handler.componentName;
                btn.dataset.methodName = option.handler.methodName;
                btn.dataset.payload = JSON.stringify(option.handler.payload || {});
            }

            contentContainer.appendChild(btn);
        });
    }

}
