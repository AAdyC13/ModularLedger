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
        this.eventAgent.on("MM:Module_enabled", this.analysisBlueprint.bind(this));
        this.eventAgent.on("PM:Finish_create_page", this.putElementToPE.bind(this));
    }
    handlerAction(action, parameters) {
        if (!action) {
            this.logger.warn('Action missing in handlerAction');
            return;
        }
        try {
            // this.logger.debug(`ElementManager handling action: ${action} with parameters: ${JSON.stringify(parameters)}`);

            switch (action) {
                case 'navigate':
                    this.eventAgent.emit('EM:navigate', {
                        pageID: parameters.pageID,
                        options: parameters.options
                    });
                    break;

                case 'callComponentMethod':
                    this.eventAgent.emit('EM:call_component_method', {
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
        const tech = data.tech;
        try {
            const blueprint = tech.blueprints || [];

            for (const bp of blueprint) {
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
            // this.logger.debug(`Putting element [${elem.id}] to page [${PageElement.id}] at slot [${elem.slotID}], DOM: ${elem.dom.outerHTML}`);
            // this.logger.debug(`PageElement [${PageElement.getRoot().outerHTML}] slotID [${PageElement.getRoot().querySelector("div.page-header")?.outerHTML}]`);
            const slot = PageElement.getRoot().querySelector(`.${elem.slotID}`);
            if (!slot) {
                this.logger.warn(`Slot [${elem.slotID}] not found in Page [${PageElement.id}] for Element [${elem.id}]`);
                return;
            }
            slot.appendChild(elem.dom);
            if (elem.hasNavigate.size > 0) {
                elem.hasNavigate.forEach((pageID) => {
                    PageElement.connectingPages.add(pageID);
                });
            }
            PageElement.connectingModules.add(elem.modID);
            elemCount++;
        });
        PageElement.elements_checked = true;
        const word = elemCount === 1 || elemCount === 0 ? 'element' : 'elements';
        this.logger.debug(`Finish putting ${elemCount} ${word} to page [${PageElement.id}]`);
    }

    createElement(modID, bp) {
        const pageID = bp.page;
        const slotID = bp.slot;
        const html = bp.html || "";
        const handlers = bp.handlers || [];
        const handlersDict = new Set();
        let hasNavigate = new Set();

        // 不穩定的 id 產生方式，暫時先這樣
        this.pageElementCounter[pageID] = (this.pageElementCounter[pageID] || 0) + 1;
        let id = `${modID}_${pageID}_${this.pageElementCounter[pageID]}`;
        const dom = this.createDOMFromString(html);

        const handlers_byEvent = [];
        // handlers_byEvent = [
        //     {
        //         name: "click",
        //         handlers: [
        //             {
        //                 selector: "#btn1",
        //                 action: "navigate",
        //                 parameters: { pageID: "somePageID", options: {} }
        //             }, ...
        //         ]
        //     }, ...
        // ];
        const groupedHandlers = new Map();
        for (const handler of handlers) {
            if (!groupedHandlers.has(handler.event)) {
                groupedHandlers.set(handler.event, []);
            }
            groupedHandlers.get(handler.event).push({
                selector: handler.selector,
                action: handler.action,
                parameters: handler.parameters
            });
        }
        handlers_byEvent.push(...Array.from(groupedHandlers.entries()).map(([event, handlers]) => ({
            name: event,
            handlers: handlers
        })));
        for (const handlerEvent of handlers_byEvent) {
            try {
                const { handlerFunc, navigates } = this.attachHandlers(dom, handlerEvent.name, handlerEvent.handlers);
                navigates.forEach(v => hasNavigate.add(v));

                if (handlerFunc) {
                    handlersDict.add({ event: handlerEvent.name, handlerFunc: handlerFunc });
                }
            } catch (error) {
                this.logger.error(`Failed to create element handler for event ${handlerEvent.name} on element ${id}: ${error}`);
            }
        }


        this.elements[id] = new PageElement(id, pageID, slotID, modID, dom, handlersDict, hasNavigate);

        // 索引
        this.elementsByPage[pageID] ??= new Set();
        this.elementsByPage[pageID].add(id);
        this.elementsByMod[modID] ??= new Set();
        this.elementsByMod[modID].add(id);
        this.logger.debug(`Element created : ${id}`);
        return id;
    }
    createDOMFromString(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstElementChild;
    }
    attachHandlers(dom, eventName, args) {
        let handlerFunc = null;
        const navigates = new Set();
        for (const each of args) {
            const element = dom.querySelector(each.selector);
            if (!element) {
                this.logger.error(`Selector [${each.selector}] not found in element DOM for attaching handler`);
                continue;
            }

            if (each.action === "navigate") {
                navigates.add(each.parameters.pageID);
            }
            element.dataset.action = each.action;
            element.dataset.parameters = JSON.stringify(each.parameters);
        }
        try {
            const systemFunc = this.handlerAction.bind(this);
            handlerFunc = (e) => {
                const target = e.target;
                const action = target.dataset.action;
                const parameters = JSON.parse(target.dataset.parameters || "{}");
                //console.log(`Event [${eventName}] triggered on element [${target.id}] with action [${action}]`);
                systemFunc(action, parameters);
            };
            dom.addEventListener(eventName, handlerFunc);

        } catch (error) {
            this.logger.error(`Failed to attach handler for event ${eventName} on element ${dom.id}: ${error}`);
        }

        return { handlerFunc, navigates };

    }

}
class PageElement {
    constructor(id, pageID, slotID, modID, dom = null, handlersDict, hasNavigate) {
        this.id = id;
        this.pageID = pageID;
        this.slotID = slotID;
        this.modID = modID;
        this.dom = dom;
        this.eventHandlers = {};
        this.handlersDict = handlersDict;
        this.hasNavigate = hasNavigate;
    }
}
