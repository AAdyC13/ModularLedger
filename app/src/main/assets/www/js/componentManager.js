const GLOBAL_OBJECT = typeof globalThis !== 'undefined' ? globalThis : window;
import { Logger } from './logger.js';

export class ComponentManager {
    constructor(logger, eventAgent, bridge, uiAgent) {
        this.logger = logger;
        this.eventAgent = eventAgent;
        this.bridge = bridge;
        this.ui = uiAgent;
        this.components = {};
        this.eventPlatform = new EventPlatform();

        this.componentsByPage = {};    // 輔助索引1
        this.componentsByMod = {};     // 輔助索引2
        this.modCounter = {}; // 計數每個模組的插件數量，目前由於是mod自定義id，所以沒有實際作用

    }
    init() {
        this.eventAgent.on("MM:Module_enabled:registerComponents", this.analysisBlueprint.bind(this));
        this.eventAgent.on("PM:Finish_create_page", this.putDOMToPE.bind(this));
        this.eventAgent.on("EM:call_component_method", this.handleComponentMethodCall.bind(this));
        this.eventAgent.on("EM:authorize_element", this.authorize_element.bind(this));
    }
    async authorize_element(data) {
        const moduleID = data.moduleID;
        const componentName = data.componentName;
        const methodName = data.methodName;
        const dom = data.dom;
        const componentID = `${moduleID}.${componentName}`;
        const component = this.components[componentID];
        if (!component) {
            this.logger.error(`Component [${componentID}] does not exist for authorization`);
            return;
        }
        const eventName = `Component:${componentID}:${methodName}`;
        this.logger.debug(`Emitting event [${eventName}] for Component authorization`);
        await this.eventPlatform.emit(eventName, { dom: dom });
    }
    async handleComponentMethodCall(data) {
        const moduleID = data.moduleID;
        const componentName = data.componentName;
        const methodName = data.methodName;
        const componentID = `${moduleID}.${componentName}`;
        const component = this.components[componentID];
        if (!component) {
            this.logger.error(`Component [${componentID}] does not exist for method call`);
            return;
        }
        const eventName = `Component:${componentID}:${methodName}`;
        // this.logger.debug(`Emitting event [${eventName}] for Component method call`);
        await this.eventPlatform.emit(eventName, {});
    }
    async analysisBlueprint(data) {
        const modID = data.id;
        const registerComponents = data.tech;
        const folderName = data.folderName;
        try {
            for (const cp of registerComponents) {
                await this.createComponent(modID, cp, folderName);
            }
            this.eventAgent.emit('CM:analysis_complete', { sysName: "ComponentManager", modID: modID }, {});
        } catch (error) {
            this.logger.error(`ComponentManager analysisBlueprint failed: ${error}`);
        }
    }
    async putDOMToPE(PageElement) {
        let compCount = 0;
        this.componentsByPage[PageElement.id]?.forEach(async (compID) => {
            const comp = this.components[compID];
            const slotName = comp.panel_location.selector;
            // this.logger.debug(`PageElement [${PageElement.getRoot().outerHTML}] slotID [${PageElement.getRoot().querySelector("div.page-header")?.outerHTML}]`);
            try {
                const slot = PageElement.getRoot().querySelector(`${slotName}`);
                if (!slot) {
                    this.logger.warn(`Slot [${slotName}] not found in Page [${PageElement.id}] for Component [${comp.id}]`);
                    return;
                }
                if (comp.type === "Panel") {
                    // this.logger.debug(`Putting component [${comp.id}] to page [${PageElement.id}] at slot [${comp.panel_location.selector}], DOM: ${comp.dom}`);
                    if (!comp.dom) {
                        this.logger.warn(`Component [${comp.id}] of type Panel has no DOM to append in Page [${PageElement.id}]`);
                        return;
                    }
                    slot.appendChild(comp.dom);
                    compCount++;
                    this.logger.debug(`Appended Component [${comp.id}] DOM to Page [${PageElement.id}] Slot [${slotName}]`);
                }

            } catch (error) {
                this.logger.error(`Failed to append Component [${comp.id}] DOM to Page [${PageElement.id}] Slot [${slotName}]: ${error.message}`);
                return;
            }
            try {
                this.logger.debug(`Initializing Component [${comp.id}]`);
                const result = await comp.init();
                if (result === false) {
                    // 警告! module component 回報初始化失敗，應該要有後續取消此 component 在page上的機制
                    this.logger.error(`Component [${comp.id}] failed to initialize.`);
                } else {
                    this.logger.debug(`Initialized Component [${comp.id}]`);
                }
            } catch (error) {
                this.logger.error(`Failed to initialize Component [${comp.id}]: ${error.message}`);
            }
        });
        PageElement.components_checked = true;
        this.logger.debug(`Finish putting [${PageElement.id}] components:${compCount}`);
        // this.eventAgent.emit('CM:Finish_put_components_to_page', PageElement.id, {});
    }
    async createComponent(modID, compTech, folderName) {
        this.modCounter[modID] = (this.modCounter[modID] || 0) + 1;
        const id = `${modID}.${compTech.name}`;
        if (this.components[id]) {
            this.logger.warn(`Component [${id}] already exists, skipping creation`);
            return id;
        }
        if (compTech.type === undefined) {
            this.logger.warn(`Component [${id}] type is undefined, default to Logic`);
        }
        const type = compTech.type || "Logic";

        const dependenciesComponent = compTech.component_dependencies || [];
        let dom = null;
        if (type === "Panel") {
            let html = "";
            let css_path = "";
            if (compTech.html_template) {
                html = await this.bridge.fetchSystemModules(`${folderName}/${compTech.html_template}`, "text");
                if (!html) {
                    this.logger.error(`Failed to fetch HTML template for component [${id}]`);
                    html = '<div>Error loading HTML</div>'; // 保底 HTML
                }
            } else {
                this.logger.warn(`Component [${id}] has no HTML template defined.`);
            }
            if (compTech.css_template) {
                css_path = `${this.bridge.virtual_domain}/assets/www/systemModules/${folderName}/${compTech.css_template}`;
            }
            try {
                dom = this.createDOM(id, html, css_path);
            } catch (error) {
                this.logger.error(`Failed to create DOM for component [${id}]: ${error.message}`);
            }
        }

        // 載入 Module 提供的 Component.JS 物件
        const ComponentObject = await this.loadJSfile(folderName, compTech.entry);

        const injectedTools = {
            callUI: {},
            systemInterface: {}
        };
        for (const tool of compTech.component_tools || []) {

            const [toolType, toolName] = tool.split(':');
            // 警告! 這樣寫沒有 toolName 的查證
            if (toolType === 'callUI') {

                injectedTools['callUI'][`${toolName}`] = (args) => this.callUI(toolName, id, args);
                // this.logger.debug(`Tool function assigned. typeof injectedTools.callUI.${toolName} is "${injectedTools['callUI']}"`);
            }
            //未來可擴充 systemInterface 等其他工具
        }


        this.components[id] = new ComponentAgent(
            id,
            type,
            modID,
            dependenciesComponent,
            ComponentObject,
            dom,
            this.eventPlatform,
            new TimerBucket(),
            new Logger(`Component:${id}`),
            new ListenerRegistry(),
            compTech.panel_location,
            injectedTools
        );
        if (dom) {
            this.componentsByPage[compTech.panel_location.pageID] ??= new Set();
            this.componentsByPage[compTech.panel_location.pageID].add(id);
        }
        if (type === "Logic") {
            // Logic type 不需要 DOM，直接初始化
            await this.components[id].init();
        }
        this.componentsByMod[modID] ??= new Set();
        this.componentsByMod[modID].add(id);
        this.logger.debug(`Component created : ${id}`);
        return id;

    }
    async deleteComponent(id) {
        const component = this.components[id];
        if (!component) {
            this.logger.warn(`Component [${id}] does not exist`);
            return false;
        }
        // 通知到 ComponentAgent
        await this.eventPlatform.emit(`Component:${id}:onDestroy`);

        delete this.components[id];
        this.componentsByMod[component.modID].delete(id);
        this.modCounter[component.modID] -= 1;
        this.logger.debug(`Component deleted : ${id}`);
        return true;
    }
    async loadJSfile(folderName, path) {
        this.logger.debug(`Loading JS file: [${folderName}] from path: ${path}`);
        const res = await import(`https://appassets.androidplatform.net/assets/www/systemModules/${folderName}/${path}`);
        if (!res) {
            throw new Error(`Failed to load JS file: ${path} in module: ${folderName}`);
        }
        if (!res.default) {
            // this.logger.debugA(`${res},${res.defult} `);
            throw new Error(`Failed to load default export from ${path} in module ${folderName}`);
        }
        return new res.default;
    }
    createDOM(id, html, css_path) {
        const host = document.createElement('div');
        host.className = 'component-dom';
        host.id = id;

        // shadow root
        const shadow = host.attachShadow({ mode: 'open' });
        if (css_path) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = css_path;
            shadow.appendChild(link);
        }

        // --- component 固定根節點 ---
        // const root = document.createElement('div');
        // root.className = 'component-root';
        // root.innerHTML = html;

        shadow.innerHTML = shadow.innerHTML + html;

        return host;
    }
    callUI(methodName, componentName, args) {
        switch (methodName) {
            case 'Toast':
                this.ui['showToast'](args.message, args.type, args.duration);
                break;
            case 'Alert':
                this.ui['alert'](componentName, args.message, args.buttonText);
                break;
            case 'Prompt':
                this.ui['prompt'](componentName, args.message, args.placeholder, args.okText, args.cancelText);
                break;
            case 'Wait':
                this.ui['wait'](componentName, args.message, args.timeout);
                break;
            case 'AdjustLayout':
                this.ui['adjustLayout']();
                break;
            case 'AboutApp':
                this.ui['aboutApp']();
                break;
            default:
                this.logger.warn(`ComponentManager.callUI: Unknown methodName: ${methodName}`);
                return;
        }

    }

}
class ComponentAgent {
    // 注入監測器到DOM
    static createProxyDOM(host, registry) {
        const shadow = host.shadowRoot;
        // 找到你的 HTML 容器
        // const wrapper = shadow.querySelector('div');
        const wrapper = shadow; //取消 div 包裝層

        // 針對 wrapper 建 Proxy
        // 不知道為什麼要這樣做，先留著
        //const proxyDOM = createDOMProxy(wrapper, registry); //沒有createDOMProxy這種函數

        return wrapper;
    }
    constructor(
        id, type, modID, dependenciesComponent = [],
        ComponentObject, dom = null, eventPlatform, timerBucket, logger, listenerRegistry,
        panel_location = null,
        injectedTools) {
        this.id = id;
        this.type = type;
        this.modID = modID;
        this.dependenciesComponent = dependenciesComponent;
        this.eventPlatform = eventPlatform;
        this.eventIDs = {}; // 儲存事件訂閱 ID 以便取消訂閱
        this.timerBucket = timerBucket;
        this.logger = logger;
        this.listenerRegistry = listenerRegistry; // Agent 擁有監聽器管理介面
        this.injectedTools = injectedTools;
        // this.logger.debug(`this.injectedTools: ${JSON.stringify(this.injectedTools)}`);

        this.object = ComponentObject; // Component 物件實例

        // 此為 Component 的未經包裝 shadow DOM 節點，禁止 Component 直接操作
        this.dom = dom; // 如果是 Panel 類型則有 HTML物件，否則為 null
        this.panel_location = panel_location;
    }
    async init() {
        this.eventPlatform.on(`Component:${this.id}:onDestroy`, this.ondestroy.bind(this));

        this.logger.debug(`Initializing Component [${this.id}]`);

        let myDOM = null;
        if (this.dom) {
            myDOM = ComponentAgent.createProxyDOM(this.dom, this.listenerRegistry);
            // 警告! Proxy系統未實現，先直接給原始DOM
        }

        this.interface = {
            myDOM: myDOM,
            tools: {
                timer: this.timerBucket,
                logger: this.logger,
                ...this.injectedTools
            },
            // CM內部事件平台
            eventPlatform: {
                emit: this.eventPlatform_emit.bind(this),
                on: this.eventPlatform_on.bind(this),
                off: this.eventPlatform_off.bind(this),
            },
            //接收CM的重要系統廣播
            systemRadio: {
                myDOM_onMount: this.systemRadio_myDOM_onMount.bind(this),
                myDOM_onUnmount: this.systemRadio_myDOM_onUnmount.bind(this),
                obliterating: this.systemRadio_obliterating.bind(this),
            }
        };
        const initResult = await this.object.init(this.interface);
        if (!initResult) {
            this.logger.error(`Component ${this.id} failed to initialize.`);
            return false;
        }
        return true;
    }
    async ondestroy() {
        this.listenerRegistry.removeAll();
        this.timerBucket.clearAll();
        Object.values(this.eventIDs).forEach(id => this.eventPlatform.off(id));
    }
    systemRadio_myDOM_onMount(handler) {
        if (!this.dom) {
            return;
        }
        this.eventIDs.DOM_onMount = this.eventPlatform.on(`Component:${this.id}:DOM_onMount`, handler);
    }
    systemRadio_myDOM_onUnmount(handler) {
        if (!this.dom) {
            return;
        }
        this.eventIDs.DOM_onUnmount = this.eventPlatform.on(`Component:${this.id}:DOM_onUnmount`, handler);
    }
    systemRadio_obliterating(handler) {
        if (!this.dom) {
            return;
        }
        this.eventIDs.onDestroy = this.eventPlatform.on(`Component:${this.id}:onDestroy`, handler);
    }
    async eventPlatform_emit(eventName, payload) {
        const name = `Component:${this.id}:${eventName}`;
        await this.eventPlatform.emit(name, payload);
    }
    eventPlatform_on(eventName, handler) {
        const name = `Component:${this.id}:${eventName}`;
        // this.logger.debug(`Subscribing to event [${name}] for Component ${this.id}`);
        try {
            const id = this.eventPlatform.on(name, handler);
            this.eventIDs[id] = id;
            return id;
        } catch (error) {
            this.logger.error(`Failed to subscribe to event [${name}] for Component ${this.id}: ${error.message}`);
            return null;
        }
    }
    eventPlatform_off(subscriptionId) {
        return this.eventPlatform.off(subscriptionId);
    }


}

class EventPlatform {
    constructor() {
        this._events = new Map();
        this._subscriptionIndex = new Map();

        //警告! 這樣的實作在非常高頻事件下可能會有記憶體洩漏風險
        this._seed = 0;
    }

    on(eventName, handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('Event handler must be a function');
        }

        const normalizedName = String(eventName);
        if (!this._events.has(normalizedName)) {
            this._events.set(normalizedName, new Map());
        }

        const subscriptionId = `${normalizedName}#${++this._seed}`;
        this._events.get(normalizedName).set(subscriptionId, handler);
        this._subscriptionIndex.set(subscriptionId, normalizedName);
        return subscriptionId;
    }

    off(subscriptionId) {
        if (!subscriptionId) return false;
        const eventName = this._subscriptionIndex.get(subscriptionId);
        if (!eventName) return false;

        const bucket = this._events.get(eventName);
        if (!bucket) return false;

        const removed = bucket.delete(subscriptionId);
        if (bucket.size === 0) {
            this._events.delete(eventName);
        }
        this._subscriptionIndex.delete(subscriptionId);
        return removed;
    }

    async emit(eventName, payload) {
        const bucket = this._events.get(String(eventName));
        if (!bucket || bucket.size === 0) return;

        const asyncTasks = [];
        bucket.forEach((handler) => {
            try {
                const result = handler(payload);
                if (result && typeof result.then === 'function') {
                    asyncTasks.push(result.then(null, (error) => {
                        console.error(`[ComponentRegistry] Event handler error for ${eventName}`, error);
                    }));
                }
            } catch (error) {
                console.error(`[ComponentRegistry] Event handler threw for ${eventName}`, error);
            }
        });

        if (asyncTasks.length > 0) {
            await Promise.allSettled(asyncTasks);
        }
    }
}
class TimerBucket {
    constructor(onSettle) {
        this._timers = new Map();
        this._seed = 0;
        this._onSettle = typeof onSettle === 'function' ? onSettle : null;
    }

    setTimeout(handler, delay = 0, ...args) {
        const timerId = ++this._seed;
        const nativeId = GLOBAL_OBJECT.setTimeout(() => {
            this._timers.delete(timerId);
            if (this._onSettle) this._onSettle(timerId);
            handler(...args);
        }, delay);
        this._timers.set(timerId, { type: 'timeout', nativeId });
        return timerId;
    }

    setInterval(handler, delay = 0, ...args) {
        const timerId = ++this._seed;
        const nativeId = GLOBAL_OBJECT.setInterval(() => {
            handler(...args);
        }, delay);
        this._timers.set(timerId, { type: 'interval', nativeId });
        return timerId;
    }

    clear(timerId) {
        const entry = this._timers.get(timerId);
        if (!entry) return false;

        if (entry.type === 'timeout') {
            GLOBAL_OBJECT.clearTimeout(entry.nativeId);
        } else {
            GLOBAL_OBJECT.clearInterval(entry.nativeId);
        }

        this._timers.delete(timerId);
        if (this._onSettle) this._onSettle(timerId);
        return true;
    }

    clearAll() {
        this._timers.forEach(({ type, nativeId }, timerId) => {
            if (type === 'timeout') {
                GLOBAL_OBJECT.clearTimeout(nativeId);
            } else {
                GLOBAL_OBJECT.clearInterval(nativeId);
            }
            if (this._onSettle) this._onSettle(timerId);
        });
        this._timers.clear();
    }
}

/**
 * ListenerRegistry 類用於管理 DOM 元素的監聽器。
 * 它提供添加、移除特定監聽器以及移除所有監聽器的功能，以避免記憶體洩漏。
 * 
 * 輸入：
 * - add(elem, type, listener, options): elem (DOM 元素), type (事件類型，如 'click'), listener (事件處理函數), options (可選的 addEventListener 選項)
 * - remove(elem, type, listener): elem (DOM 元素), type (事件類型), listener (事件處理函數)
 * - removeAll(): 無輸入參數
 * 
 * 輸出：
 * - add: 無返回值
 * - remove: 無返回值
 * - removeAll: 無返回值
 */
class ListenerRegistry {
    constructor() {
        this.listeners = new Map(); // element → [{type, listener, options}]
    }

    add(elem, type, listener, options) {
        if (!this.listeners.has(elem)) {
            this.listeners.set(elem, []);
        }
        this.listeners.get(elem).push({ type, listener, options });
    }

    remove(elem, type, listener) {
        if (!this.listeners.has(elem)) return;
        let arr = this.listeners.get(elem);
        this.listeners.set(
            elem,
            arr.filter(l => !(l.type === type && l.listener === listener))
        );
    }

    removeAll() {
        for (const [elem, arr] of this.listeners.entries()) {
            for (const { type, listener, options } of arr) {
                elem.removeEventListener(type, listener, options);
            }
        }
        this.listeners.clear();
    }
}