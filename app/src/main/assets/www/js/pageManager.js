export class PageManager {
    constructor(logger, bridge, eventAgent, layoutIDs) {
        this.logger = logger;
        this.bridge = bridge;
        this.eventAgent = eventAgent;
        this.layoutIDs = layoutIDs;
        this.templates = {};
        this.PageElements = {}; // page elements
        this.indexPage = null;
    }
    async init(preLoadPages = []) {
        try {
            // 監聽事件
            this.eventAgent.on("MM:Module_enabled", this.analysisBlueprint.bind(this));
            this.eventAgent.on("RT::Index_page_is", this.indexPagePreload.bind(this));
            this.eventAgent.on("Router:Starting", this.sendingPageToRouter.bind(this));
            this.eventAgent.on("Router:Finish_navigate", this.preLoadPages.bind(this));
            this.eventAgent.on("MM:Module_fully_enabled", this.handleModuleFullyEnabled.bind(this));

            const res = await fetch("https://appassets.androidplatform.net/assets/www/pages/layout.html");
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const layouts = doc.body;
            for (const id of Object.keys(this.layoutIDs)) {
                const cls = this.layoutIDs[id];
                const tpl = layouts.querySelector(`.${cls}`);

                if (!tpl) {
                    this.logger.warn(`Layout not found (null): ${id} (${cls})`);
                } else if (!(tpl instanceof Element)) {
                    this.logger.warn(`Layout found but not an Element: ${id} (${cls}), ${tpl}`);
                } else if (typeof tpl.cloneNode !== 'function') {
                    this.logger.error(`Found element lacks cloneNode: ${id} (${cls}), ${tpl}`);
                } else {
                    this.templates[id] = tpl;
                    this.logger.debug(`Layout loaded: ${id} (${cls})`);
                }
            }
            this.logger.debug(`Page templates cached: ${Object.keys(this.templates).length}`);
        } catch (err) {
            this.logger.error(`Failed to load layouts: ${err}`);
            throw err;
        }
        for (const page of preLoadPages) {
            this.createPage(page.pageID, page.layoutID);
        }
    }
    handleModuleFullyEnabled(data) {
        for (const pageID in this.PageElements) {
            this.sendingFinishCreate(pageID);
        }
    }
    preLoadPages(pageID) {
        try {
            if (!this.PageElements[pageID]) {
                this.logger.error(`Preload page [${pageID}] not found`);
                throw new Error(`Preload page [${pageID}] not found`);
            }
            for (const connectedPageID of this.PageElements[pageID].connectingPages) {
                if (!this.PageElements[connectedPageID]) {
                    this.logger.error(`Connected preload page [${connectedPageID}] not found`);
                    return;
                    // throw new Error(`Connected preload page [${connectedPageID}] not found`);
                }
                this.sendingPageToRouter(connectedPageID);
            }

        } catch (error) {
            this.logger.error(`PageManager preLoadPages failed: ${error}`);
        }
    }
    indexPagePreload(pageID) {
        this.indexPage = pageID;
        try {
            if (!this.PageElements[pageID]) {
                this.logger.error(`Index page [${pageID}] not found`);
                throw new Error(`Index page [${pageID}] not found`);
            }
            this.sendingPageToRouter(pageID);
        } catch (error) {
            this.logger.error(`PageManager indexPageLoad failed: ${error}`);
        }
    }


    analysisBlueprint(data) {
        const modID = data.id;
        const tech = data.tech;
        try {
            const blueprint = tech.blueprints || [];

            const pagesModNeed = new Set();
            for (const bp of blueprint) {
                pagesModNeed.add(bp.page);
            }
            for (const pageID of pagesModNeed) {
                if (!this.PageElements[pageID]) {
                    //現階段不自動建立頁面，一切先用系統預載頁面
                    //this.createPage();
                    //this.PageElements[pageID].connectingModules.push(modID);
                    this.logger.error(`PageElement [${pageID}] not found for module: ${modID}`);
                    this.eventAgent.emit('PM:Fail_create_page', pageID);
                    continue;
                }
                if (!this.PageElements[pageID].connectingModules.has(modID)) {
                    this.PageElements[pageID].connectingModules.add(modID);
                    //this.sendingFinishCreate(pageID);
                }
            }
            this.eventAgent.emit('PM:analysis_complete', { sysName: "PageManager", modID: modID }, {});
        } catch (error) {
            this.logger.error(`PageManager analysisBlueprint failed: ${error}`);
        }
    }
    createPage(pageID, layoutID) {
        if (!this.layoutIDs[layoutID]) {
            this.logger.error(`LayoutID ${layoutID} is not defined in runtimeConfig`);
            throw new Error(`LayoutID ${layoutID} is not defined`);
        }
        const template = this.templates[layoutID];
        if (!template) {
            this.logger.error(`No template found for layoutID: ${layoutID}`);
            throw new Error(`Template for ${layoutID} not found`);
        }
        const dom = template.cloneNode(true);

        this.PageElements[pageID] = new PageElement(pageID, dom);
        this.logger.debug(`Page created: ${pageID}`);
        //this.sendingFinishCreate(pageID);
    }

    async sendingPageToRouter(pageID) {
        try {
            this.logger.debug(`Sending page to Router: ${pageID}`);
            const PE = this.PageElements[pageID];
            if (!PE) {
                throw new Error(`PageElement [${pageID}] not found`);
            }
            if (!this.checkPageStable(pageID)) {
                await this.waitForStable(pageID);
            }
            this.eventAgent.emit('PM:Finish_preloade_page', PE, {});

        } catch (error) {
            this.logger.error(`PageManager sendingPageToRouter failed: ${error}`);
        }
    }


    // 警告! 等待頁面被建立並穩定下來(暫時沒想到更好的方法，暴力破解)
    waitForStable(pageID) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (this.checkPageStable(pageID)) {
                    clearInterval(interval);
                    resolve();
                } else if (Date.now() - startTime > 1000) {
                    clearInterval(interval);
                    reject(new Error(`Page not stable within 1 second: ${pageID}`));
                }
            }, 50); // 每50ms檢查一次
        });
    }
    checkPageStable(pageID) {
        // 此處可擴充檢查元素是否都已經就緒
        const PE = this.PageElements[pageID];
        return PE.elements_checked && PE.components_checked;
    }
    sendingFinishCreate(pageID) {
        if (!this.PageElements[pageID]) {
            this.logger.error(`PageElement [${pageID}] not found for sendingFinishCreate`);
            return;
        }
        this.eventAgent.emit('PM:Finish_create_page', this.PageElements[pageID], {});
        this.PageElements[pageID].elements_checked = false;
        this.PageElements[pageID].components_checked = false;
    }

}
class PageElement {
    constructor(pageID, dom) {
        this.id = pageID;
        this.dom = dom; // 真正的 DOM element（cloneNode 出來的）
        this.connectingPages = new Set(); // 連接的pages
        this.connectingModules = new Set(); // 連接的modules
        this.elements_checked = false;
        this.components_checked = false;
    }

    getRoot() {
        return this.dom;  // Router 用來 attach/detach
    }

    query(selector) {
        return this.dom.querySelector(selector);
    }

    queryAll(selector) {
        return this.dom.querySelectorAll(selector);
    }

    addClass(cls) {
        this.dom.classList.add(cls);
    }

    removeClass(cls) {
        this.dom.classList.remove(cls);
    }

    // 允許 ComponentManager 注入元件
    attachComponent(component) { }

    // 允許 EM 注入 element 監聽器
    mountElements() { }

    // 要不要 onShow/onHide 可以選
    onShow() { }
    onHide() { }
}