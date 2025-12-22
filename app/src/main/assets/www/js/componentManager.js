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
        this.modCounter = {}; // 計數每個模組的插件數量

        // [新增] 用於暫存尚未就緒的組件授權請求
        this.pendingAuthorizations = []; 
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
        
        // [修正] 如果組件尚未存在，則將請求暫存起來
        if (!component) {
            this.logger.debug(`Component [${componentID}] not ready for authorization, queuing request.`);
            this.pendingAuthorizations.push(data);
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
            try {
                const slot = PageElement.getRoot().querySelector(`${slotName}`);
                if (!slot) {
                    this.logger.warn(`Slot [${slotName}] not found in Page [${PageElement.id}] for Component [${comp.id}]`);
                    return;
                }
                if (comp.type === "Panel") {
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
            compTech.panel_location
        );
        if (dom) {
            this.componentsByPage[compTech.panel_location.pageID] ??= new Set();
            this.componentsByPage[compTech.panel_location.pageID].add(id);
        }
        if (type === "Logic") {
            await this.components[id].init();
        }
        this.componentsByMod[modID] ??= new Set();
        this.componentsByMod[modID].add(id);
        this.logger.debug(`Component created : ${id}`);

        // [新增] 檢查並處理此組件的暫存授權請求
        await this.processPendingAuthorizations(id);

        return id;
    }

    // [新增] 處理暫存請求的輔助方法
    async processPendingAuthorizations(componentID) {
        const pending = this.pendingAuthorizations.filter(data => 
            `${data.moduleID}.${data.componentName}` === componentID
        );
        
        // 從暫存列隊中移除已處理的項目
        this.pendingAuthorizations = this.pendingAuthorizations.filter(data => 
            `${data.moduleID}.${data.componentName}` !== componentID
        );

        for (const data of pending) {
            this.logger.debug(`Processing queued authorization for [${componentID}]`);
            await this.authorize_element(data);
        }
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

        shadow.innerHTML = shadow.innerHTML + html;

        return host;
    }

}
class ComponentAgent {
    // 注入監測器到DOM
    static createProxyDOM(host, registry) {
        const shadow = host.shadowRoot;
        const wrapper = shadow; 
        return wrapper;
    }
    constructor(
        id, type, modID, dependenciesComponent = [],
        ComponentObject, dom = null, eventPlatform, timerBucket, logger, listenerRegistry,
        panel_location = null) {
        this.id = id;
        this.type = type;
        this.modID = modID;
        this.dependenciesComponent = dependenciesComponent;
        this.eventPlatform = eventPlatform;
        this.eventIDs = {}; 
        this.timerBucket = timerBucket;
        this.logger = logger;
        this.listenerRegistry = listenerRegistry; 

        this.object = ComponentObject; 
        this.dom = dom; 
        this.panel_location = panel_location;

    }
    async init() {
        this.eventPlatform.on(`Component:${this.id}:onDestroy`, this.ondestroy.bind(this));

        this.logger.debug(`Initializing Component [${this.id}]`);

        let myDOM = null;
        if (this.dom) {
            myDOM = ComponentAgent.createProxyDOM(this.dom, this.listenerRegistry);
        }
        this.interface = {
            myDOM: myDOM,
            tools: {
                timer: this.timerBucket,
                logger: this.logger
            },
            eventPlatform: {
                emit: this.eventPlatform_emit.bind(this),
                on: this.eventPlatform_on.bind(this),
                off: this.eventPlatform_off.bind(this),
            },
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
        this.logger.debug(`Subscribing to event [${name}] for Component ${this.id}`);
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

class ListenerRegistry {
    constructor() {
        this.listeners = new Map(); 
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