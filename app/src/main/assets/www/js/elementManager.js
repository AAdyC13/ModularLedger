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
        this.eventAgent.on("Module_enabled", this.analysisBlueprint.bind(this));
        this.eventAgent.on("Finish_create_page", this.putElementToPE.bind(this));
    }

    analysisBlueprint(data) {
        const modID = data.id;
        const tech = data.tech;
        try {
            const blueprint = tech.blueprints || [];

            for (const bp of blueprint) {
                this.createElement(modID, bp);
            }
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
            if ( !slot ) {
                this.logger.warn(`Slot [${elem.slotID}] not found in Page [${PageElement.id}] for Element [${elem.id}]`);
                return;
            }
            slot.appendChild(elem.dom);
            elemCount++;
        });
        PageElement.elements_checked = true;
        this.logger.debug(`Finish putting [${PageElement.id}] elements:${elemCount}`);
        // this.eventAgent.emit('Finish_put_elements_to_page', PageElement.id, {});
    }

    createElement(modID, bp) {
        const pageID = bp.page;
        const slotID = bp.slot;
        const goto = bp.goto || false;
        const html = bp.html || "";
        const handlers = bp.handlers || {};
        // handlers未實作

        // 不穩定的 id 產生方式，暫時先這樣
        this.pageElementCounter[pageID] = (this.pageElementCounter[pageID] || 0) + 1;
        let id = `${modID}_${pageID}_${this.pageElementCounter[pageID]}`;

        const dom = this.createDOMFromString(html);
        this.elements[id] = new PageElement(id, pageID, slotID, modID, goto, dom);

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
    attachHandlers(dom, pe) {
        for (const [event, handlerCode] of Object.entries(pe.handlers)) {
            try {
                const handlerFunc = new Function('event', handlerCode);
                dom.addEventListener(event, handlerFunc);
            } catch (error) {
                this.logger.error(`Failed to attach handler for event ${event} on element ${pe.id}: ${error}`);
            }
        }
    }
}
class PageElement {
    constructor(id, pageID, slotID, modID, goto = false, dom = null) {
        this.id = id;
        this.pageID = pageID;
        this.slotID = slotID;
        this.modID = modID;
        this.goto = goto;
        this.dom = dom;
        this.eventHandlers = {};
    }
}
