/**
 * Modules Manager - 模組管理器
 */
export class ModulesManager {
    constructor(logger, bridge, eventAgent, whitelist, moduleLoadTimeout_s = 20) {
        this.logger = logger;
        this.bridge = bridge;
        this.eventAgent = eventAgent;
        this.moduleDict = null;
        this.whitelist = whitelist || [];
        this.logger.debug(`Whitelist set: ${this.whitelist.join(', ')}`);
        this.schemaLoadFailed = false;
        this.moduleLoadTimeout_s = moduleLoadTimeout_s;
    }

    /**
     * 初始化模組管理器
     */
    async init(logger_forModule) {
        this.eventAgent.on('CM:analysis_complete', this.handleAnalysisComplete.bind(this));
        this.eventAgent.on('EM:analysis_complete', this.handleAnalysisComplete.bind(this));
        this.eventAgent.on('PM:analysis_complete', this.handleAnalysisComplete.bind(this));
        try {
            const schema = await this.bridge.getSchema('module-info.schema');
            const techSchema = await this.bridge.getSchema('module-tech.schema');
            // this.logger.debug(`Module schema loaded: ${typeof schema}, content: ${JSON.stringify(schema)}`);
            if (!schema || !techSchema) {
                throw new Error('Failed to load module schema from Android');
            }
            Module.init(logger_forModule, schema, techSchema);
        } catch (error) {
            this.logger.error('Failed to load Module schema: ' + error.message);
            this.schemaLoadFailed = true;
            this.logger.warn('Module loading will be restricted to whitelist only');
        }
        try {
            await this.loadSystemModules();
        } catch (error) {
            this.logger.error('Error enabling system modules: ' + error);
        }
        const summaries = Object.values(this.moduleDict)
            .map(m => `  - ${m.getSummary()}`)
            .join('\n');
        this.logger.info(`System modules loaded: ${Object.keys(this.moduleDict).length} modules\n${summaries}`);
    }
    handleAnalysisComplete(data) {
        const modID = data.modID;
        const sys = data.sysName;
        const mod = this.moduleDict[modID];
        // this.logger.debug(`Handling analysis complete for module: ${modID}, system: ${sys}`);
        if (!mod) {
            this.logger.warn(`Module ${modID} not found in moduleDict`);
            return;
        }
        switch (sys) {
            case 'ElementManager':
                mod.status.EM_check = true;
                break;
            case 'ComponentManager':
                mod.status.CM_check = true;
                break;
            case 'PageManager_element':
                mod.status.PMe_check = true;
                break;
            case 'PageManager_creating':
                mod.status.PMc_check = true;
                break;
            default:
                this.logger.warn(`Unknown system name in analysis complete: ${sys}`);
                return;
        }
        //this.logger.debug(`Module analysis complete: ${modID} from system: ${sys}`);
    }

    /**
     * 檢查模組是否在白名單中
     */
    isInWhitelist(moduleId) {
        return this.whitelist.includes(moduleId);
    }


    async loadSystemModules() {
        try {
            const list = await this.bridge.getSystemModulesList();

            if (!list) {
                this.logger.warn('Failed to get system modules list from Android');
                this.moduleDict = {};
                return;
            }

            // 將每個模組資料轉換為 Module 實例
            this.moduleDict = {};
            list.forEach(data => {
                try {
                    // 如果 Schema 載入失敗,只載入白名單模組
                    if (this.schemaLoadFailed) {
                        if (!this.isInWhitelist(data.id)) {
                            this.logger.warn(`Module ${data.id} not in whitelist, skipped`);
                            return;
                        }
                        // 白名單模組跳過驗證
                        this.logger.warn(`Loading whitelisted module ${data.id} without validation`);
                        const module = new Module(data, true);
                        this.moduleDict[module.id] = module;
                        return;
                    }

                    // 正常載入並驗證模組
                    const module = new Module(data);
                    this.moduleDict[module.id] = module;
                } catch (error) {
                    this.logger.error(`Failed to load module ${data.id || 'unknown'}: ${error.message}`);
                }
            });

        } catch (error) {
            this.logger.error('Error parsing system modules list: ' + error);
            this.moduleDict = {};
        }
    }

    async enableSystemModules() {
        const modIds = new Set(this.getPrefixedIds('systemModule'));
        this.logger.debug(`System module IDs to enable: ${Array.from(modIds).join(', ')}`);
        await this.enableModules(modIds);
    }

    /**
     * 啟用模組
     * @param {Set} modIds - 要啟動的 Idset
     */
    async enableModules(modIds) {
        const totalMods = modIds.size;
        this.logger.info(`Enabling ${JSON.stringify(Array.from(modIds))} modules...`);
        const ans = this.monitorModuleLoading.bind(this)(modIds);
        try {
            const mods = this.modFindByIds(modIds)
            const filenNames = mods.map(m => m.folderName);
            const techs = await this.bridge.getTechs(filenNames);
            mods.forEach((mod) => {

                const techData = techs[mod.folderName];
                if (techData) {
                    let res = null;
                    try {
                        res = mod.loadTech(techData)
                    } catch (error) {
                        this.logger.error(`Failed to loadTech for module: ${mod.id}: ` + error);
                    }
                    if (res) {
                        // 啟用邏輯在此添加
                        for (const techName in mod.tech) {
                            const emitName = `MM:Module_enabled:${techName}`;
                            // this.logger.debug(`Emitting event ${emitName} for module: ${mod.id}`);
                            this.eventAgent.emit(emitName, {
                                id: mod.id,
                                tech: mod.tech[techName],
                                folderName: mod.folderName
                            });
                        }
                        this.logger.debug(`Enabling module: ${mod.id}`);

                    } else {
                        this.logger.error(`Module ${mod.id} tech loading failed, skipping enable`);
                    }
                } else {
                    this.logger.warn(`No tech.json found for module: ${mod.id}`);
                }
            });
        } catch (error) {
            this.logger.error(`Error enabling module: ` + error);
        }
        const unable = await ans;
        if (unable.size > 0) {

            // 警告! 超時，這裡應該要阻止部分模組的啟動過程

            this.logger.warn(`Some modules failed to enable within timeout: ${Array.from(unable).join(', ')}`);
        }
        const num = totalMods - unable.size;
        const word = num === 1 || num === 0 ? 'module' : 'modules';
        this.eventAgent.emit('MM:Module_fully_enabled', { id: null }); // 暫時，強制 reset all pages
        this.logger.info(`Successfully enabled ${num} ${word}.`);
    }
    /**
     * 監視模組啟動狀態
     * @param {Set} modIds - 要啟動的 Idset
     * @returns {Promise<Set>} 返回未完成的模組 ID Set，如果全部完成則為空 Set
     */
    async monitorModuleLoading(modIds) {
        const checkInterval = 50; // 毫秒
        const timeout = this.moduleLoadTimeout_s * 1000;
        let elapsed = 0;

        return new Promise((resolve, reject) => {
            const intervalId = setInterval(() => {
                const toRemove = new Set();

                for (const modId of modIds) {
                    const mod = this.moduleDict[modId];
                    if (mod.checkeLoadingStatus()) {
                        toRemove.add(modId);
                    }
                }

                if (toRemove.size > 0) {
                    for (const id of toRemove) {
                        this.logger.debug(`Module fully enabled: ${id}`);
                        modIds.delete(id);
                    }
                }

                if (modIds.size === 0) {
                    clearInterval(intervalId);
                    resolve(new Set()); // 全部模組完成，返回空 Set
                }

                elapsed += checkInterval;
                if (elapsed >= timeout) {
                    clearInterval(intervalId);
                    resolve(modIds); // 返回剩餘未完成的模組 ID Set
                }
            }, checkInterval);
        });
    }

    /**
     * 尋找模組
     * @param {Set} modIds
     * @returns {Array<Module>} 尋找結果
     */
    modFindByIds(modIds) {
        const matchedMods = [];
        for (const id of modIds) {
            if (this.moduleDict[id]) {
                matchedMods.push(this.moduleDict[id]);
            }
        }
        return matchedMods;
    }

    /**
     * 取得所有指定前綴的模組 id
     * @returns {Array<string>}
     */
    getPrefixedIds(prefix) {
        return Object.values(this.moduleDict)
            .filter(m => m && typeof m.id === 'string' && m.id.startsWith(prefix + '.'))
            .map(m => m.id);
    }
}

/**
 * Module - 模組類
 */
class Module {
    static schema = null;
    static logger = null;
    static techSchema = null;

    /**
     * 載入 Schema (只執行一次)
     * @throws {Error} Schema 載入失敗時拋出錯誤
     */
    static init(logger, schema, techSchema) {
        Module.logger = logger
        Module.schema = schema;
        Module.techSchema = techSchema;

    }

    constructor(data, skipValidation = false) {
        // 如果不跳過驗證,則執行標準驗證流程
        if (!skipValidation) {
            if (Module.schema === null) {
                throw new Error('Module schema not initialized');
            }
            // 先驗證資料,不通過直接拋出錯誤
            this.validate_info(data);
        }

        // 基礎賦值保證 - 確保所有屬性都有值
        this.name = data.name || 'Unknown Whitelist Module';
        this.id = data.id || 'unknown.WhitelistModule';
        this.folderName = data.folderName || '';
        this.info = {
            version: data.version || '0.0.0',
            author: data.author || 'Unknown Author',
            description: data.description || '',
            license: data['module license'] || '',
            tags: Array.isArray(data.tags) ? data.tags : []
        }
        this.permissions = null;
        this.tech = {};
        this.status = {
            enabled: false,
            techLoaded: false,
            EM_check: true,
            CM_check: true,
            PMe_check: true, // PageManager's element check
            PMc_check: true,// PageManager's creating check
            MD_check: true
        }

        // 標記是否為白名單模組(未經驗證)
        this.isWhitelisted = skipValidation;

    }
    checkeLoadingStatus() {
        return this.status.EM_check && this.status.CM_check && this.status.PMc_check && this.status.PMe_check;
    }
    loadTech(data) {
        if (!Module.techSchema) {
            // throw new Error('Tech schema not available');
            Module.logger.error('Tech schema not available');
            return false;
        }
        if (Object.keys(data).length === 0) {
            Module.logger.debug(`Empty tech for module: ${this.id}`);
        } else {
            try {
                // 警告! 目前跳過驗證，這個函數有大問題
                //this.validate_tech(data);
            } catch (error) {
                // throw new Error('Tech validation failed: ' + error);
                Module.logger.error(`Tech validation failed for module ${this.id}: ` + error);
                return false;
            }
        }
        if (!data.permissions) {
            Module.logger.warn(`No permissions defined for module ${this.id}`);
        } else {
            this.permissions = new Set(data.permissions);

            if (this.permissions.has('registerPages')) {
                this.tech["registerPages"] = data.registerPages || [];
                this.status.PMc_check = false;
            }
            if (this.permissions.has('registerElements')) {
                this.tech["registerElements"] = data.registerElements || [];
                this.status.EM_check = false;
                // this.status.PMe_check = false;
            }
            if (this.permissions.has('registerComponents')) {
                this.tech["registerComponents"] = data.registerComponents || [];
                this.status.CM_check = false;
            }
            if (this.permissions.has('moduleDpendencies')) {
                this.tech["moduleDpendencies"] = data.moduleDpendencies || [];
                this.status.MD_check = false;
            }
        }
        this.status.techLoaded = true;
        Module.logger.debug(`Tech loaded for module: ${this.id}`);
        return true;
    }
    unloadTech() {
        this.permissions = null;
        this.tech = null;
        this.status.techLoaded = false;
        Module.logger.debug(`Tech unloaded for module: ${this.id}`);
    }

    // 警告! 目前寫法下，以下驗證函數放在 Module 實例中沒意義。

    /**
     * 根據 Schema info驗證模組資料
     * @throws {Error} 驗證失敗時拋出錯誤
     */
    validate_info(data) {
        // 如果是白名單模組,跳過驗證
        if (!Module.schema || !Module.schema.required) {
            Module.logger.warn('Schema not available, skipping validation');
            return;
        }

        // 檢查必填欄位
        const required = Module.schema.required || [];
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Missing required field "${field}" in module ${data.id || 'unknown'}`);
            }
        }

        // 檢查欄位格式
        const properties = Module.schema.properties || {};

        // 驗證 ID 格式
        if (properties.id && properties.id.pattern) {
            const idPattern = new RegExp(properties.id.pattern);
            if (!idPattern.test(data.id)) {
                throw new Error(`Invalid ID format: ${data.id}`);
            }
        }

        // 驗證版本號格式
        if (properties.version && properties.version.pattern) {
            const versionPattern = new RegExp(properties.version.pattern);
            if (!versionPattern.test(data.version)) {
                throw new Error(`Invalid version format in ${data.id}: ${data.version}`);
            }
        }

        // 驗證字串最小長度
        for (const [key, prop] of Object.entries(properties)) {
            if (prop.type === 'string' && prop.minLength && data[key]) {
                if (data[key].length < prop.minLength) {
                    throw new Error(`Field "${key}" length less than ${prop.minLength} in ${data.id}`);
                }
            }
        }
    }

    /**
     * 根據 Schema tech驗證模組資料
     * @throws {Error} 驗證失敗時拋出錯誤
     */
    validate_tech(techData) {
        const data = this;
        let techSchemaObj = Module.techSchema;
        // try {
        //     if (typeof techSchemaObj === 'string') {
        //         techSchemaObj = JSON.parse(techSchemaObj);
        //     }
        //     if (techSchemaObj && techSchemaObj.type && techSchemaObj.content) {
        //         // encoded by AndroidBridge: { type: 'Object', content: {...} }
        //         techSchemaObj = techSchemaObj.content;
        //     }
        // } catch (e) {
        //     throw new Error('Failed to parse tech schema: ' + e.message);
        // }

        // if (!techSchemaObj || !techSchemaObj.properties) {
        //     Module.logger && Module.logger.warn && Module.logger.warn('Tech schema missing properties, skipping tech validation');
        //     return;
        // }

        // 1) permissions
        if (techSchemaObj.properties.permissions) {
            const permsSchema = techSchemaObj.properties.permissions;
            const enumList = permsSchema.items && permsSchema.items.enum ? permsSchema.items.enum : null;
            if (techData.permissions !== undefined) {
                if (!Array.isArray(techData.permissions)) {
                    throw new Error(`Invalid tech.permissions for ${data.id}: must be an array`);
                }
                if (enumList) {
                    for (const p of techData.permissions) {
                        if (!enumList.includes(p)) {
                            throw new Error(`Invalid permission '${p}' in ${data.id}`);
                        }
                    }
                }
            }
        }

        // 2) blueprints
        if (techSchemaObj.properties.blueprints) {
            const bpSchema = techSchemaObj.properties.blueprints;
            const pageEnum = bpSchema.items && bpSchema.items.properties && bpSchema.items.properties.page && bpSchema.items.properties.page.enum ? bpSchema.items.properties.page.enum : null;
            if (techData.blueprints !== undefined) {
                if (!Array.isArray(techData.blueprints)) {
                    throw new Error(`Invalid tech.blueprints for ${data.id}: must be an array`);
                }
                techData.blueprints.forEach((bp, idx) => {
                    if (typeof bp !== 'object' || bp === null) throw new Error(`Blueprint[${idx}] in ${data.id} must be an object`);
                    // required fields: page, slot, element
                    if (!bp.page) throw new Error(`Blueprint[${idx}] missing 'page' in ${data.id}`);
                    if (!bp.slot) throw new Error(`Blueprint[${idx}] missing 'slot' in ${data.id}`);
                    if (!bp.element) throw new Error(`Blueprint[${idx}] missing 'element' in ${data.id}`);
                    if (pageEnum && !pageEnum.includes(bp.page)) {
                        throw new Error(`Invalid blueprint.page '${bp.page}' in ${data.id}`);
                    }
                    if (bp.props !== undefined && (typeof bp.props !== 'object' || bp.props === null)) {
                        throw new Error(`Blueprint[${idx}].props in ${data.id} must be an object if provided`);
                    }
                });
            }
        }

        // 3) components
        if (techSchemaObj.properties.components) {
            const compSchema = techSchemaObj.properties.components;
            if (techData.components !== undefined) {
                if (!Array.isArray(techData.components)) {
                    throw new Error(`Invalid tech.components for ${data.id}: must be an array`);
                }
                techData.components.forEach((c, idx) => {
                    if (typeof c !== 'object' || c === null) throw new Error(`Component[${idx}] in ${data.id} must be an object`);
                    // required: name, type, entry
                    if (!c.name) throw new Error(`Component[${idx}] missing 'name' in ${data.id}`);
                    if (!c.type) throw new Error(`Component[${idx}] missing 'type' in ${data.id}`);
                    if (!c.entry) throw new Error(`Component[${idx}] missing 'entry' in ${data.id}`);
                    if (compSchema.items && compSchema.items.properties && compSchema.items.properties.type && compSchema.items.properties.type.enum) {
                        const allowed = compSchema.items.properties.type.enum;
                        if (!allowed.includes(c.type)) {
                            throw new Error(`Invalid component.type '${c.type}' in ${data.id}`);
                        }
                    }
                    if (c.component_dependencies !== undefined) {
                        if (!Array.isArray(c.component_dependencies)) throw new Error(`component_dependencies of component[${idx}] in ${data.id} must be an array`);
                        for (const dep of c.component_dependencies) {
                            if (typeof dep !== 'string') throw new Error(`component_dependency '${dep}' in ${data.id} must be a string`);
                        }
                    }
                });
            }
        }

        // 4) module_dependencies
        if (techSchemaObj.properties.module_dependencies) {
            if (techData.module_dependencies !== undefined) {
                if (!Array.isArray(techData.module_dependencies)) {
                    throw new Error(`Invalid tech.module_dependencies for ${data.id}: must be an array`);
                }
                for (const md of techData.module_dependencies) {
                    if (typeof md !== 'string') throw new Error(`module_dependency '${md}' in ${data.id} must be a string`);
                }
            }
        }

        // all good: attach tech and mark
        this.tech = techData;
        this.status.techLoaded = true;
        // Module.logger.debug(`Tech validation passed for ${this.id}`);
    }

    /**
     * 取得模組資訊摘要
     */
    getSummary() {
        return `${this.name} (${this.id}) v${this.info.version} by ${this.info.author}`;
    }
}
