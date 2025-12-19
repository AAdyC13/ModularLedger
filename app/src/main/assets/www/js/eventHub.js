class EventHub {
    constructor() {
        this.logger = null;
        this.listeners = {};   // { "agent:event": [handler, ...] }
        this.sticky = {};      // { "agent:event": payload }
        this.queue = [];       // queued events when not ready
        this.ready = true;     // 可根據需求開啟
        this.unknownAgent = null

    }

    init(logger, logger_forEventAgent) {
        try {
            this.logger = logger;
            EventAgent.init(logger_forEventAgent);
        } catch (err) {
            console.error(`EventHub init error: ${err}`);
            throw err;
        }
        this.unknownAgent = new EventAgent("unknownAgent");
    }

    createAgent(name) {
        this.logger.debug(`Create EventAgent: [${name}]`);
        return new EventAgent(name);
    }

    // 訂閱事件
    on(eventName, handler, agent = this.unknownAgent) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        const box = {
            agent: agent,
            handler: handler
        };
        // 這邊還可以優化，讓同一個agent box存所有handler，而不是每次on都new一個box

        this.listeners[eventName].push(box);

        // this.logger.debug(` Agent [${agent.name}] Handler registered for event: ${eventName}`);

        // Sticky replay
        if (eventName in this.sticky) {
            box.handler(this.sticky[eventName]);
        }

    }

    // 發送事件
    async emit(eventName, payload, options = {}, agent = new EventAgent("unknownAgent")) {

        //this.logger.debug(`Agent [${agent.name}] emit: [${eventName}: ${payload}]`);

        // Sticky
        if (options.sticky) {
            this.sticky[eventName] = payload;
        }

        // Queue if not ready
        if (!this.ready) {
            this.queue.push({ eventName, payload, options, agent });
            return;
        }

        const boxs = this.listeners[eventName] || [];

        // this.logger.debug(` Emitting to ${boxs.length} listeners for event: ${eventName}`);

        // 收集每個 handler 的 Promise，並等待全部完成（或至少 settle）
        const promises = boxs.map(box => {
            box.agent.receiving = true;
            const p = Promise.resolve().then(() => box.handler(payload));
            return p
                .catch(err => {
                    if (this.logger && this.logger.error) {
                        this.logger.error(`Error in event handler for event ${eventName}: ${err}`);
                    } else {
                        console.error(err);
                    }
                })
                .finally(() => {
                    box.agent.receiving = false;
                });
        });

        await Promise.allSettled(promises);
    }

    // 啟動後重播 queue
    async setReady() {
        this.ready = true;

        // 依序回放並等待每個事件處理完成（保留順序）
        for (const { eventName, payload, options, agent } of this.queue) {
            await this.emit(eventName, payload, options, agent);
        }

        this.queue = [];
    }
    
}

const eventHub = new EventHub();
export { eventHub };


// -----------------------------------------
// EventAgent
// -----------------------------------------

class EventAgent {

    static logger = null;
    static init(logger) {
        EventAgent.logger = logger;
    }
    static msgPrefix(myName, msg) {
        return ` [${myName}] ${msg}`;
    }

    static async waitUntilFinish(getValue) {
        while (getValue()) {
            await new Promise(resolve => setTimeout(resolve, 50));// every 50ms check
        }
    }

    constructor(name) {
        this.name = name;
        this.receiving = false;
    }

    on(eventTitle, handler) {
        eventHub.on(eventTitle, handler, this);
    }

    async emit(eventTitle, payload, options = {}) {
        await eventHub.emit(eventTitle, payload, options, this);
    }
    getReceiving() {
        return this.receiving;
    }
    async callMeBack() {
        if (!this.receiving) {
            return;
        }
        return EventAgent.waitUntilFinish(this.getReceiving.bind(this));
    }
}
