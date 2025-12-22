export class PageManager {
    constructor(logger, bridge, eventAgent) {
        this.logger = logger;
        this.bridge = bridge;
        this.eventAgent = eventAgent;
        this.PageElements = {}; // page elements
        this.indexPage = null;
        this.moduleCssLinks = document.getElementById('sys-module-css-links');
    }
    async init(logger_forPageElement) {
        try {
            // 監聽事件
            this.eventAgent.on("MM:Module_enabled:registerPages", this.analysisBlueprint.bind(this));
            this.eventAgent.on("Router:Start_indexPage", this.indexPagePreload.bind(this));
            this.eventAgent.on("Router:Finish_navigate", this.preLoadPages.bind(this));
            this.eventAgent.on("MM:Module_fully_enabled", this.handleModuleFullyEnabled.bind(this));
            PageElement.setLogger(logger_forPageElement);
        } catch (err) {
            this.logger.error(`Failed to load layouts: ${err}`);
            throw err;
        }
    }
    async analysisBlueprint(data) {
        const modID = data.id;
        const registerPages = data.tech;
        const folderName = data.folderName;
        for (const bp of registerPages) {
            const pageID = bp.pageID;
            const html_layout = `${folderName}/${bp.html_layout}`;
            const css_template = `${this.bridge.virtual_domain}/assets/www/systemModules/${folderName}/${bp.css_template}`;
            const page_options = bp.page_options || {};
            const registerFreeElements = bp.registerFreeElements || [];
            const registerFreeComponents = bp.registerFreeComponents || [];
            try {
                await this.createPage(modID,
                    pageID, html_layout, css_template, page_options, registerFreeElements, registerFreeComponents);



            } catch (error) {
                this.logger.error(`Failed to register page [${pageID}]: ${error}`);
            }
        }
        this.eventAgent.emit('PM:analysis_complete', { sysName: "PageManager_creating", modID: modID }, {});

    }
    handleModuleFullyEnabled(data) {
        for (const pageID in this.PageElements) {
            this.checkingPage(pageID);
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
                    continue;
                    // throw new Error(`Connected preload page [${connectedPageID}] not found`);
                }
                this.sendingPageToRouter(connectedPageID);
            }

        } catch (error) {
            this.logger.error(`PageManager preLoadPages failed: ${error}`);
        }
    }
    async indexPagePreload(pageID) {
        this.indexPage = pageID;
        try {
            const pageElement = this.PageElements[pageID];
            if (!pageElement) {
                this.logger.error(`Index page [${pageID}] not found`);
                throw new Error(`Index page [${pageID}] not found`);
            }
            this.logger.debug(`Index page preload: ${pageID}`);
            await this.sendingPageToRouter(pageID);
        } catch (error) {
            this.logger.error(`PageManager indexPageLoad failed: ${error}`);
        }
    }

    async createPage(modID, pageID, html_layout, css_template, page_options, registerFreeElements, registerFreeComponents) {
        let link = null;
        let freeElements = new Map();
        let components_spot = new Map();

        const row_html = await this.bridge.fetchSystemModules(html_layout, "text");
        if (css_template) {
            // 修正路徑（避免 JSON 內的反斜線）
            css_template = css_template.replace(/\\/g, "/");
            const res = await this.cssExists(css_template);
            if (res) {
                link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = css_template;
                link.setAttribute('data-module-css', 'true');

            } else {
                this.logger.warn(`module [${modID}] CSS template not found for page [${pageID}]`);
            }
        }
        const host = document.createElement('div');
        host.className = 'module_display_layout';
        let dom = host;
        let shadowDOM = false;

        // 把片段解析到 template，然後再把 content 插入 host
        const template = document.createElement('template');
        template.innerHTML = row_html.trim(); // 避免多餘 whitespace

        // 將內容放進 host
        host.appendChild(template.content.cloneNode(true));

        // 警告! 模組css目前將堆疊至head，未來可能需要改成按頁面載入與卸載
        if (link) this.moduleCssLinks.appendChild(link);



        if (page_options.allowReplaceElements) {

            for (const sel of registerFreeElements) {
                freeElements.set(sel.selector, {
                    changeInnerTEXT: !!sel.options.changeInnerTEXT,
                    changeID: !!sel.options.changeID,
                });
            }
        }

        if (page_options.allowAddComponents) {

            for (const sel of registerFreeComponents) {
                components_spot.set(sel.selector, {
                    // 未來你要加 options 再放這裡
                });
            }
        }

        this.PageElements[pageID] = new PageElement(modID, pageID, dom, freeElements, components_spot);
        this.logger.debug(`Page created: ${pageID}`);
        return true;
    }
    async cssExists(url) {
        try {
            const res = await this.bridge.fetch(url);
            const text = await res.text();
            return text.trim().length > 0;
        } catch {
            return false;
        }
    }

    async sendingPageToRouter(pageID) {
        try {
            const PE = this.PageElements[pageID];
            if (!PE) {
                throw new Error(`PageElement [${pageID}] not found`);
            }
            if (!this.checkPageStable(pageID)) {
                await this.waitForStable(pageID);
            }
            this.logger.debug(`Sending page to Router: ${pageID}`);
            const a = () => {
                return JSON.stringify({
                    modID: PE.modID,
                    id: PE.id,
                    connectingModules: JSON.stringify([...PE.connectingModules]),
                    connectingPages: JSON.stringify([...PE.connectingPages]),
                });
            };
            // this.logger.debug(`PageElement details: ${a()}`);
            this.eventAgent.emit('PM:Finish_preloade_page', PE, {});

        } catch (error) {
            this.logger.error(`PageManager sendingPageToRouter failed: ${error}`);
        }
    }


    // 警告! 等待頁面被建立並穩定下來(暫時沒想到更好的方法，暴力破解)
    async waitForStable(pageID) {
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
    checkingPage(pageID) {
        if (!this.PageElements[pageID]) {
            this.logger.error(`PageElement [${pageID}] not found for checkingPage`);
            return;
        }
        this.PageElements[pageID].elements_checked = false;
        this.PageElements[pageID].components_checked = false;
        this.eventAgent.emit('PM:Finish_create_page', this.PageElements[pageID], {});
    }

}
class PageElement {
    static logger = null;
    static setLogger(logger) {
        PageElement.logger = logger;
    }
    constructor(modID, pageID, dom, freeElements, components_spot) {
        this.modID = modID;
        this.id = pageID;
        this.dom = dom;
        this.freeElements = freeElements || new Map();
        this.components_spot = components_spot || new Map();

        this.connectingPages = new Set(); // 連接的pages
        this.connectingModules = new Set(); // 連接的modules
        this.elements_checked = false;
        this.components_checked = false;
        this.eventHandlers = new Map();
    }

    getRoot() {
        return this.dom;
    }

    /**
     * 判斷自由元素狀態
     */
    isFreeElement(selector) {
        // PageElement.logger.debug(`Free element ${[...this.freeElements]}`);
        if (!this.freeElements) {
            return [false];
        }
        const elemOptions = this.freeElements.get(selector);
        if (elemOptions) {
            if (elemOptions.hasChanged) {
                return [true, elemOptions.changedBy];
            }
            return [true];
        }
        return [false];
    }

    replaceElement(replacer, modID) {
        // PageElement.logger.debug(`Attempting to replace free element [${replacer.selector}] in Page [${this.id}] by Module [${modID}]`);
        const selector = replacer.selector;
        const result = this.isFreeElement(selector);

        if (!result[0]) {
            PageElement.logger.warn(`Selector [${selector}] is not a free element in Page [${this.id}]`);
            return;
        }
        if (result[1]) {
            PageElement.logger.warn(`Selector [${selector}] in Page [${this.id}] has already been changed by Module [${result[1]}]`);
            return;
        }
        const root = this.getRoot();
        const spot = root.querySelector(selector);

        const options = this.freeElements.get(selector);
        let hasChanged = false;
        // changeInnerTEXT
        if (replacer.changeInnerTEXT) {
            if (options.changeInnerTEXT) {
                spot.innerText = replacer.changeInnerTEXT;
                hasChanged = true;
            } else {
                PageElement.logger.warn(`changeInnerTEXT not allowed for selector [${selector}] in Page [${this.id}]`);
            }
        }
        // changeID
        if (replacer.changeID) {
            if (options.changeID) {
                spot.id = replacer.changeID;
                hasChanged = true;
            } else {
                PageElement.logger.warn(`changeID not allowed for selector [${selector}] in Page [${this.id}]`);
            }
        }

        if (hasChanged) {
            PageElement.logger.debug(`Free element [${selector}] in Page [${this.id}] replaced by Module [${modID}]`);
            options.hasChanged = true;
            options.changedBy = modID;
        }
    }
    setHandler(selector, eventName, handlerFunc) {
        this.eventHandlers.set(`${selector}::${eventName}`, handlerFunc);
    }
    hasHandler(selector, eventName) {
        return this.eventHandlers.has(`${selector}::${eventName}`);
    }
    deleteHandler(selector, eventName) {
        const key = `${selector}::${eventName}`;
        const handler = this.eventHandlers.get(key);
        if (!handler) {
            PageElement.logger.warn(`No handler found for selector [${selector}] and event [${eventName}] to delete`);
            return;
        };
        const el = this.getRoot().querySelector(selector);
        if (el) {
            el.removeEventListener(eventName, handler);
        }
        // 無論元素是否存在，都刪掉紀錄
        this.eventHandlers.delete(key);
        PageElement.logger.debug(`Successfully deleted handler for selector [${selector}] and event [${eventName}]`);
    }

    // 要不要 onShow/onHide 可以選
    onShow() { }
    onHide() { }
}