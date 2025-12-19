// 留著做參考用，實際上不使用此檔案

const SHADOW_SUPPORTED = typeof HTMLElement !== 'undefined' && !!HTMLElement.prototype.attachShadow;
const GLOBAL_OBJECT = typeof globalThis !== 'undefined' ? globalThis : window;
const HAS_FETCH = typeof GLOBAL_OBJECT.fetch === 'function';

class EventHub {
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

function resolveTargetElement(target) {
    if (!target) {
        throw new Error('Mount target is required');
    }

    if (typeof target === 'string') {
        const element = document.querySelector(target);
        if (!element) {
            throw new Error(`Mount target not found for selector: ${target}`);
        }
        return element;
    }

    if (target instanceof Element) {
        return target;
    }

    throw new TypeError('Unsupported mount target type');
}

function diffProps(previous, next) {
    const changed = {};
    let hasChanges = false;
    const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);

    keys.forEach((key) => {
        const prevValue = previous ? previous[key] : undefined;
        const nextValue = next ? next[key] : undefined;
        if (!Object.is(prevValue, nextValue)) {
            changed[key] = { previous: prevValue, current: nextValue };
            hasChanges = true;
        }
    });

    return { changed, hasChanges };
}

function hasLifecycleSupport(ComponentCtor) {
    if (!ComponentCtor || !ComponentCtor.prototype) return false;
    return typeof ComponentCtor.prototype.onCreate === 'function';
}



class ComponentHandle {
    constructor({ id, registry, definition, template, initialProps, parentHandle, useShadow }) {
        this.id = id;
        this.registry = registry; //提供互動介面：允許 ComponentHandle 實例透過 this.registry 存取 ComponentManager 的方法
        this.definition = definition; //提供配置存取：允許 ComponentHandle 實例存取組件的靜態屬性
        this.template = template;
        this.currentProps = { ...(initialProps || {}) };
        this.parentHandle = parentHandle || null;
        this.useShadow = useShadow;

        this.instance = null;
        this.api = null;
        this.lifecycle = {
            onCreate: false,
            onMount: false,
            onUpdate: false,
            onUnmount: false,
            onDestroy: false
        };

        this.hostElement = null;
        this.shadowRoot = null;
        this.mountRoot = null;
        this.templateInjected = false;
        this.isMounted = false;
        this.isDestroyed = false;

        this.subscriptions = new Set();
        this.childHandles = new Set();
        this.timerIds = new Set();
        this.timers = new TimerBucket((timerId) => {
            this.timerIds.delete(timerId);
        });
    }

    attachInstance(instance, api) {
        this.instance = instance;
        this.api = api;
        this.lifecycle.onCreate = typeof instance?.onCreate === 'function';
        this.lifecycle.onMount = typeof instance?.onMount === 'function';
        this.lifecycle.onUpdate = typeof instance?.onUpdate === 'function';
        this.lifecycle.onUnmount = typeof instance?.onUnmount === 'function';
        this.lifecycle.onDestroy = typeof instance?.onDestroy === 'function';
    }

    registerChild(handle) {
        if (handle && handle !== this) {
            this.childHandles.add(handle);
        }
    }

    unregisterChild(handle) {
        this.childHandles.delete(handle);
    }

    trackSubscription(subscriptionId) {
        if (subscriptionId) {
            this.subscriptions.add(subscriptionId);
        }
    }

    unregisterSubscription(subscriptionId) {
        if (!subscriptionId) return;
        if (this.subscriptions.has(subscriptionId)) {
            this.subscriptions.delete(subscriptionId);
        }
    }

    trackTimer(timerId) {
        if (timerId) {
            this.timerIds.add(timerId);
        }
    }

    clearTimer(timerId) {
        if (!timerId) return false;
        const cleared = this.timers.clear(timerId);
        if (cleared) {
            this.timerIds.delete(timerId);
        }
        return cleared;
    }

    async mount(target) {
        if (this.isDestroyed) {
            throw new Error(`Component ${this.id} is already destroyed`);
        }

        const container = resolveTargetElement(target);
        this.ensureHostElement();

        if (!this.templateInjected && this.template && this.mountRoot) {
            this.mountRoot.innerHTML = this.template;
            this.templateInjected = true;
        }

        if (this.hostElement.parentElement !== container) {
            container.appendChild(this.hostElement);
        }

        if (!this.isMounted) {
            this.isMounted = true;
            const mountRoot = this.getPublicRoot();
            if (this.lifecycle.onMount) {
                await this.instance.onMount(mountRoot);
            } else if (typeof this.instance?.render === 'function') {
                await this.instance.render(mountRoot);
            }
        }

        return this;
    }

    async update(nextProps = {}) {
        if (this.isDestroyed) {
            throw new Error(`Component ${this.id} is already destroyed`);
        }

        const { changed, hasChanges } = diffProps(this.currentProps, nextProps || {});
        if (!hasChanges) return this;

        this.currentProps = { ...(nextProps || {}) };

        if (this.lifecycle.onUpdate) {
            await this.instance.onUpdate(changed);
        }

        return this;
    }

    async unmount() {
        if (!this.isMounted) return this;

        if (this.lifecycle.onUnmount) {
            await this.instance.onUnmount();
        } else if (typeof this.instance?.unmount === 'function') {
            await this.instance.unmount();
        }

        if (this.hostElement?.parentNode) {
            this.hostElement.parentNode.removeChild(this.hostElement);
        }

        this.isMounted = false;
        this.clearAutoResources();
        return this;
    }

    async destroy() {
        if (this.isDestroyed) return;

        await this.unmount();

        const children = Array.from(this.childHandles);
        for (const child of children) {
            await this.registry.destroyComponent(child);
        }

        this.clearAutoResources();

        if (this.lifecycle.onDestroy) {
            await this.instance.onDestroy();
        } else if (typeof this.instance?.destroy === 'function') {
            await this.instance.destroy();
        }

        if (this.parentHandle) {
            this.parentHandle.unregisterChild(this);
        }

        this.registry.releaseHandle(this);

        this.instance = null;
        this.api = null;
        this.hostElement = null;
        this.shadowRoot = null;
        this.mountRoot = null;
        this.isDestroyed = true;
    }

    ensureHostElement() {
        if (this.hostElement) return;

        const hostTag = this.definition.hostTag || 'div';
        const host = document.createElement(hostTag);
        host.dataset.component = this.definition.name;
        host.dataset.componentId = this.id;
        host.classList.add('component-host', `cmp-${this.definition.name}`);

        if (this.useShadow && SHADOW_SUPPORTED) {
            this.shadowRoot = host.attachShadow({ mode: 'open' });
            this.mountRoot = this.shadowRoot;
        } else {
            host.classList.add(`cmp-surface-${this.definition.name}`);
            this.mountRoot = host;
        }

        this.hostElement = host;
    }

    getPublicRoot() {
        return this.mountRoot || this.hostElement;
    }

    clearAutoResources() {
        if (this.subscriptions.size > 0) {
            this.subscriptions.forEach((subscriptionId) => {
                this.registry.eventHub.off(subscriptionId);
            });
            this.subscriptions.clear();
        }

        if (this.timerIds.size > 0) {
            this.timers.clearAll();
            this.timerIds.clear();
        }
    }
}

export class ComponentManager {
    constructor(logger, eventAgent) {
        this.logger = logger;
        this.eventAgent = eventAgent;
        this.components = {};

        this.definitions = new Map();
        this.definitionAliases = new Map();
        this.templateCache = new Map();
        this.classRegistryByComponent = new Map();
        this.classRegistryByName = new Map();
        this.handlesById = new Map();
        this.singletons = new Map();
        this.eventHub = new EventHub();
        this._seed = 0;

    }
    init() {
        this.eventAgent.on("MM:Module_enabled:registerComponents", this.analysisBlueprint.bind(this));
    }
    analysisBlueprint(data) {
        const modID = data.id;
        const registerComponents = data.tech;
        try {
            for (const bp of registerComponents) {
                this.createElement(modID, bp);
            }
        } catch (error) {
            this.logger.error(`ComponentManager analysisBlueprint failed: ${error}`);
        }
    }

    registerDefinition(definition) {
        if (!definition?.name) {
            throw new Error('Component definition must include a name');
        }

        const normalized = {
            ...definition,
            singleInstance: definition.singleInstance ?? definition.isSingleton ?? false,
            useShadow: definition.useShadow ?? true
        };

        this.definitions.set(normalized.name, normalized);
        this.definitionAliases.set(normalized.name.toLowerCase(), normalized.name);
        return normalized;
    }

    registerClass(className, ctor, options = {}) {
        if (typeof ctor !== 'function') {
            throw new TypeError('Component constructor must be a function');
        }

        if (className) {
            this.classRegistryByName.set(className, ctor);
        }

        if (options.componentName) {
            this.classRegistryByComponent.set(options.componentName, ctor);
        }
    }

    async preloadTemplates(names = null) {
        const targets = Array.isArray(names) && names.length > 0 ? names : Array.from(this.definitions.keys());
        const preloadTasks = targets.map(async (name) => {
            const definition = this.definitions.get(name);
            if (!definition) return;
            if (!definition.html) return;
            await this._loadTemplate(definition);
        });
        await Promise.all(preloadTasks);
    }

    async createComponent(name, props = {}, options = {}) {
        const definition = this.definitions.get(name);
        if (!definition) {
            throw new Error(`Unknown component: ${name}`);
        }

        if (definition.singleInstance) {
            const existingHandle = this.singletons.get(name);
            if (existingHandle) {
                if (options.forceNew) {
                    throw new Error(`Component ${name} is single-instance and already exists`);
                }
                return existingHandle;
            }
        }

        const ComponentCtor = this._resolveComponentClass(definition, options.classOverride);
        const template = await this._loadTemplate(definition);

        const handleId = `${definition.name}#${++this._seed}`;
        const handle = new ComponentHandle({
            id: handleId,
            registry: this,
            definition,
            template,
            initialProps: props,
            parentHandle: options.parentHandle || null,
            useShadow: options.useShadow ?? definition.useShadow
        });

        const api = this._createComponentApi(handle);
        const instance = this._instantiateComponent(ComponentCtor, {
            definition,
            template,
            props,
            api,
            handle
        });
        handle.attachInstance(instance, api);

        if (handle.parentHandle) {
            handle.parentHandle.registerChild(handle);
        }

        this.handlesById.set(handleId, handle);
        if (definition.singleInstance) {
            this.singletons.set(definition.name, handle);
        }

        if (handle.lifecycle.onCreate) {
            await instance.onCreate({
                props: { ...handle.currentProps },
                template,
                api,
                definition,
                handle
            });
        }

        return handle;
    }

    getComponent(identifier) {
        if (!identifier) return null;

        if (identifier instanceof ComponentHandle) {
            return identifier;
        }

        if (typeof identifier === 'string') {
            if (this.handlesById.has(identifier)) {
                return this.handlesById.get(identifier);
            }

            if (this.singletons.has(identifier)) {
                return this.singletons.get(identifier);
            }

            const aliasKey = identifier.toLowerCase();
            const canonicalName = this.definitionAliases.get(aliasKey);
            if (canonicalName && this.singletons.has(canonicalName)) {
                return this.singletons.get(canonicalName);
            }
        }

        return null;
    }

    async destroyComponent(identifier) {
        const handle = this.getComponent(identifier);
        if (!handle) return false;

        await handle.destroy();
        return true;
    }

    releaseHandle(handle) {
        this.handlesById.delete(handle.id);
        if (handle.definition.singleInstance && this.singletons.get(handle.definition.name) === handle) {
            this.singletons.delete(handle.definition.name);
        }
    }

    _resolveComponentClass(definition, override) {
        if (override) return override;

        const directByComponent = this.classRegistryByComponent.get(definition.name);
        if (directByComponent) return directByComponent;

        const directByName = this.classRegistryByName.get(definition.className) || this.classRegistryByName.get(definition.name);
        if (directByName) return directByName;

        throw new Error(`No constructor registered for component: ${definition.name}`);
    }

    _instantiateComponent(ComponentCtor, context) {
        const usesLifecycle = hasLifecycleSupport(ComponentCtor);
        if (usesLifecycle) {
            return new ComponentCtor({
                definition: context.definition,
                template: context.template,
                props: { ...context.props },
                api: context.api,
                handle: context.handle
            });
        }

        const legacyBridge = {
            createComponent: async (type, props) => this.createComponent(type, props, { parentHandle: context.handle }),
            getComponent: (id) => this.getComponent(id),
            destroyComponent: async (id) => this.destroyComponent(id)
        };

        return new ComponentCtor(context.template, legacyBridge, {
            props: { ...context.props },
            api: context.api,
            definition: context.definition,
            handle: context.handle
        });
    }

    _createComponentApi(handle) {
        const createComponent = async (type, props = {}) => {
            const childHandle = await this.createComponent(type, props, { parentHandle: handle });
            return childHandle;
        };

        const getComponent = (identifier) => this.getComponent(identifier);

        const destroyComponent = async (identifier) => {
            await this.destroyComponent(identifier);
        };

        const on = (eventName, handler) => {
            const subscriptionId = this.eventHub.on(eventName, handler);
            handle.trackSubscription(subscriptionId);
            return subscriptionId;
        };

        const off = (subscriptionId) => {
            handle.unregisterSubscription(subscriptionId);
            this.eventHub.off(subscriptionId);
        };

        const emit = (eventName, payload) => this.eventHub.emit(eventName, payload);

        const setTimeoutFn = (callback, delay, ...args) => {
            const timerId = handle.timers.setTimeout(callback, delay, ...args);
            handle.trackTimer(timerId);
            return timerId;
        };

        const clearTimeoutFn = (timerId) => handle.clearTimer(timerId);

        const setIntervalFn = (callback, delay, ...args) => {
            const timerId = handle.timers.setInterval(callback, delay, ...args);
            handle.trackTimer(timerId);
            return timerId;
        };

        const clearIntervalFn = (timerId) => handle.clearTimer(timerId);

        const storage = {
            get(key, defaultValue = null) {
                if (!GLOBAL_OBJECT?.localStorage) return defaultValue;
                const raw = GLOBAL_OBJECT.localStorage.getItem(key);
                if (raw === null) return defaultValue;
                try {
                    return JSON.parse(raw);
                } catch (_) {
                    return raw;
                }
            },
            set(key, value) {
                if (!GLOBAL_OBJECT?.localStorage) return;
                const serialized = typeof value === 'string' ? value : JSON.stringify(value);
                GLOBAL_OBJECT.localStorage.setItem(key, serialized);
            },
            remove(key) {
                if (!GLOBAL_OBJECT?.localStorage) return;
                GLOBAL_OBJECT.localStorage.removeItem(key);
            }
        };

        const network = {
            fetch: (...args) => {
                if (!HAS_FETCH) {
                    throw new Error('Fetch API is not available in this environment');
                }
                return GLOBAL_OBJECT.fetch(...args);
            }
        };

        const permissions = {
            async has(name, descriptor = {}) {
                if (!GLOBAL_OBJECT?.navigator?.permissions?.query) return false;
                try {
                    const status = await GLOBAL_OBJECT.navigator.permissions.query({ name, ...descriptor });
                    return status.state === 'granted';
                } catch (_) {
                    return false;
                }
            }
        };

        return {
            createComponent,
            getComponent,
            destroyComponent,
            on,
            off,
            emit,
            setTimeout: setTimeoutFn,
            clearTimeout: clearTimeoutFn,
            setInterval: setIntervalFn,
            clearInterval: clearIntervalFn,
            storage,
            network,
            permissions
        };
    }

    async _loadTemplate(definition) {
        if (!definition.html) return null;
        if (this.templateCache.has(definition.name)) {
            return this.templateCache.get(definition.name);
        }

        if (!HAS_FETCH) {
            console.warn('[ComponentRegistry] Fetch API not available; skip template preload');
            this.templateCache.set(definition.name, null);
            return null;
        }

        try {
            const response = await GLOBAL_OBJECT.fetch(definition.html);
            if (response.ok) {
                const template = await response.text();
                this.templateCache.set(definition.name, template);
                return template;
            }

            console.warn(`[ComponentRegistry] Failed to preload template for ${definition.name}: ${response.status}`);
            this.templateCache.set(definition.name, null);
            return null;
        } catch (error) {
            console.error(`[ComponentRegistry] Error preloading template for ${definition.name}`, error);
            this.templateCache.set(definition.name, null);
            return null;
        }
    }
}


componentRegistry.registerClass('SettingPanel', SettingPanel, { componentName: 'settingPanel' });
componentRegistry.registerClass('Calculator', Calculator, { componentName: 'calculator' });
componentRegistry.registerClass('ScrollController', ScrollController, { componentName: 'scrollController' });
componentRegistry.registerClass('RecordCalendar', RecordCalendar, { componentName: 'recordCalendar' });

export const createComponent = (name, props = {}, options = {}) => componentRegistry.createComponent(name, props, options);
export const getComponent = (identifier) => componentRegistry.getComponent(identifier);
export const destroyComponent = (identifier) => componentRegistry.destroyComponent(identifier);
export const preloadComponentTemplates = (names) => componentRegistry.preloadTemplates(names);
export const registerComponentDefinition = (definition) => componentRegistry.registerDefinition(definition);
export const registerComponentClass = (className, ctor, options = {}) => componentRegistry.registerClass(className, ctor, options);

