
export class DB_Interface {
    constructor(logger) {
        this.logger = logger;
        this.bridge = null;
        this.moduleDB = null;
        this.sysDB = null;
    }

    init() {
        this.sysDB = {

        };
        this.moduleDB = {
            new: (moduleName, instanceName, config) => {
                return this.newModuleDB(moduleName, instanceName, config);
            },
            get: (moduleName, instanceName) => {
                return this.getModuleDB(moduleName, instanceName);
            },
            delete: (moduleName, instanceName) => {
                return this.deleteModuleDB(moduleName, instanceName);
            }
        }

    }

    newModuleDB(moduleName, instanceName, config) {
        return this.bridge.callSync('newModuleInstance', moduleName, instanceName, config);
    }
    getModuleDB(moduleName, instanceName) {
        return this.bridge.callSync('getModuleInstance', moduleName, instanceName);
    }
    deleteModuleDB(moduleName, instanceName) {
        return this.bridge.callSync('deleteModuleInstance', moduleName, instanceName);
    }
}