
export class DataBaseManager {
    constructor() {
        this.logger = null;
        this.bridge = null;
        this.eventHub = null;
    }

    init(logger, bridge, eventHub) {
        this.logger = logger;
        this.bridge = bridge;
        this.eventHub = eventHub;
        this.logger.debug('DataBaseManager initialized');
    }
}