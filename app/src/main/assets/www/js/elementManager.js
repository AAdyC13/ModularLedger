export class ElementManager {
    constructor(logger, eventAgent) {
        this.logger = logger;
        this.eventAgent = eventAgent;
        this.elements = {}; // 儲存所有元素實例
        this.elementsByPage = {};    // 輔助索引1
        this.elementsByMod = {};     // 輔助索引2
        this.pageElementCounter = {}; // 計數每個頁面的元素數量
    }
    init() {
        this.eventAgent.on("MM:Module_enabled:registerElements", this.analysisBlueprint.bind(this));
        this.eventAgent.on("PM:Finish_create_page", this.putElementToPE.bind(this));
    }
    async EventListenerHub(target, action, parameters) {
        if (!action) {
            this.logger.warn('Action missing in handlerAction');
            return;
        }
        try {
            // this.logger.debug(`ElementManager handling action: ${action} with parameters: ${JSON.stringify(parameters)}`);

            switch (action) {
                case 'navigate':
                    await this.eventAgent.emit('EM:navigate', {
                        pageID: parameters.pageID,
                        options: parameters.options
                    });
                    break;

                case 'callComponentMethod':
                    await this.eventAgent.emit('EM:call_component_method', {
                        moduleID: parameters.moduleID,
                        componentName: parameters.componentName,
                        methodName: parameters.methodName,
                    });
                    break;

                default:
                    this.logger.error(`Unknown action "${action}"`);
            }
        } catch (error) {
            this.logger.error(`Error handling action "${action}": ${error}`);
        }
    };



    analysisBlueprint(data) {
        const modID = data.id;
        const registerElements = data.tech;
        try {
            for (const bp of registerElements) {
                this.createElement(modID, bp);
            }
            this.eventAgent.emit('EM:analysis_complete', { sysName: "ElementManager", modID: modID }, {});
        } catch (error) {
            this.logger.error(`ElementManager analysisBlueprint failed: ${error}`);
        }

    }
    putElementToPE(PageElement) {
        let elemCount = 0;
        this.elementsByPage[PageElement.id]?.forEach((elemID) => {
            const elem = this.elements[elemID];
            if (elem.replacers) {
                for (const replacer of elem.replacers) {
                    PageElement.replaceElement(replacer, elem.modID);
                }
            }

            let dom = null;
            if (elem.handlers) {
                if (elem.selector === "") {
                    dom = PageElement.getRoot();
                } else {
                    dom = PageElement.getRoot().querySelector(elem.selector);
                }
                if (!dom) {
                    this.logger.error(`Selector [${elem.selector}] not found in page DOM for attaching handlers`);
                    return;
                }
                for (const handler of elem.handlers) {
                    if (!PageElement.hasHandler(elem.selector, handler.event)) {
                        let attachedFunc = null;
                        switch (handler.event) {
                            case 'click':
                                //attachedFunc type = function or false
                                this.logger.debug(`Click handler attached for selector [${handler.selector}]`);
                                attachedFunc = this.attachHandler(dom, handler.event);

                                // Record connecting pages if navigation is involved
                                if (handler.action === 'navigate') {
                                    const pageID = handler.parameters.pageID;
                                    if (typeof pageID === "string" && pageID.trim() !== "") {
                                        PageElement.connectingPages.add(pageID);
                                    }
                                }
                                break;
                            
                            case 'authorize':
                                if (!elem.static.authorizeHandlerAttached) {
                                    //attachedFunc type = null
                                    const slot = dom.querySelector(handler.selector)
                                    // this.logger.debug(`Attaching authorize handler for selector [${slot.innerHTML}]`);
                                    if (!slot) {
                                        this.logger.error(`Selector [${handler.selector}] not found in element DOM for attaching authorize handler`);
                                        attachedFunc = false;
                                        break;
                                    }
                                    this.eventAgent.emit('EM:authorize_element', {
                                        moduleID: handler.parameters.moduleID,
                                        componentName: handler.parameters.componentName,
                                        methodName: handler.parameters.methodName,
                                        dom: slot
                                    }, { sticky: true });
                                    this.logger.debug(`Authorize handler attached for selector [${handler.selector}]`);
                                    elem.static.authorizeHandlerAttached = true;
                                } else {
                                    this.logger.warn(`Authorize handler already attached for selector [${handler.selector}]`);
                                }
                                break;
                        }

                        if (attachedFunc) {
                            PageElement.setHandler(elem.selector, handler.event, attachedFunc);
                        } else if (attachedFunc === false) {
                            this.logger.error(`Failed to attach handler for event [${handler.event}] on selector [${elem.selector}]`);
                            continue;
                        } else if (attachedFunc === null) {
                            // do nothing for null
                        }
                    }
                    this.attachDataset(dom, handler.selector, handler.action, handler.parameters);
                }
            }
            PageElement.connectingModules.add(elem.modID);
            elemCount++;
        });
        PageElement.elements_checked = true;
        const word = elemCount === 1 || elemCount === 0 ? 'element' : 'elements';
        this.logger.debug(`Finish putting ${elemCount} ${word} to page [${PageElement.id}]`);
    }
    attachDataset(dom, selector, action, row_parameters) {
        const element = dom.querySelector(selector);
        if (!element) {
            this.logger.error(`Selector [${selector}] not found in element DOM for attaching handler`);
            return false;
        }
        switch (action) {
            case 'navigate':
                element.dataset.action = 'navigate';
                element.dataset.parameters = JSON.stringify({
                    pageID: row_parameters.pageID,
                    options: row_parameters.options || {}
                });
                break;
            case 'callComponentMethod':
                element.dataset.action = 'callComponentMethod';
                element.dataset.parameters = JSON.stringify({
                    moduleID: row_parameters.moduleID,
                    componentName: row_parameters.componentName,
                    methodName: row_parameters.methodName,
                });
                break;
        }
    }
    attachHandler(dom, eventName) {
        let handlerFunc = false;
        try {
            const systemInterface = this.EventListenerHub.bind(this);

            // 警告! 隨著Handler需求變多，這裡可能需要改成switch-case來分流不同的事件處理邏輯
            handlerFunc = async (e) => {
                e.preventDefault();
                const target = e.target;
                const action = target.dataset.action;
                if (action) {
                    try {
                        const parameters = JSON.parse(target.dataset.parameters);
                        if (action === 'navigate') { 
                            await this.waitButtonRelease(target);
                        }
                        await systemInterface(target, action, parameters);
                    } catch (error) {
                        this.logger.error(`Error processing event handler parameters: ${error}`);
                    }
                }

            };
            dom.addEventListener(eventName, handlerFunc);

        } catch (error) {
            this.logger.error(`Failed to attach handler for event ${eventName} on element ${dom.id}: ${error}`);
        }
        return handlerFunc;
    }
    waitButtonRelease(el) {
    return new Promise(resolve => {
        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener('transitionend', finish);
            resolve();
        };

        el.addEventListener('transitionend', finish, { once: true });

        // fallback，防止無動畫或 prefers-reduced-motion
        setTimeout(finish, 200);
    });
}
    createElement(modID, bp) {
        const pageID = bp.page;
        const selector = bp.selector;
        const replacers = bp.replacers || null;
        const handlers = bp.handlers || null;

        // 不穩定的 id 產生方式，暫時先這樣
        this.pageElementCounter[pageID] = (this.pageElementCounter[pageID] || 0) + 1;
        let id = `${modID}_${pageID}_${this.pageElementCounter[pageID]}`;

        this.elements[id] = new Element(
            id, pageID, selector, modID, replacers, handlers);

        // 索引
        this.elementsByPage[pageID] ??= new Set();
        this.elementsByPage[pageID].add(id);
        this.elementsByMod[modID] ??= new Set();
        this.elementsByMod[modID].add(id);
        this.logger.debug(`Element created : ${id}`);
        return id;
    }

}
class Element {
    constructor(id, pageID, selector, modID, replacers, handlers) {
        this.id = id;
        this.pageID = pageID;
        this.selector = selector;
        this.modID = modID;
        this.replacers = replacers;
        this.handlers = handlers;
        this.static = {}
    }
}