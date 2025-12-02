export class ComponentManager {
    constructor(logger, eventAgent, bridge) {
        this.logger = logger;
        this.eventAgent = eventAgent;
        this.bridge = bridge;
        this.components = {};
        this.componentsByPage = {};    // 輔助索引1
        this.componentsByMod = {};     // 輔助索引2
        this.modCounter = {}; // 計數每個模組的插件數量

        this.definitions = new Map();
        this.definitionAliases = new Map();
        this.templateCache = new Map();
        this.classRegistryByComponent = new Map();
        this.classRegistryByName = new Map();
        this.handlesById = new Map();
        this.singletons = new Map();
        this.eventHub = new EventHub();


    }
    init() {
        this.eventAgent.on("Module_enabled", this.analysisBlueprint.bind(this));
    }
    analysisBlueprint(data) {
        const modID = data.id;
        const tech = data.tech;
        const folderName = data.folderName;
        try {
            const comp = tech.components || [];

            for (const cp of comp) {
                this.createComponent(modID, cp, folderName);
            }
        } catch (error) {
            this.logger.error(`ComponentManager analysisBlueprint failed: ${error}`);
        }
    }
    createComponent(modID, compTech, folderName) {
        this.modCounter[modID] = (this.modCounter[modID] || 0) + 1;
        const id = `${modID}.${this.modCounter[modID]}.${compTech.name}`;

        if (compTech.type === undefined) {
            this.logger.warn(`Component [${id}] type is undefined, default to Logic`);
        }
        const type = compTech.type || "Logic";

        const dependenciesComponent = compTech.component_dependencies || [];


        const dom = this.createDOMFromString(compTech.html || "");

        // 開始讀取 Module 提供的 Component.JS 物件
        const ComponentObject = this.loadJSfile(folderName, path);

        this.components[id] = new ComponentAgent();

        this.componentsByPage[pageID] ??= new Set();
        this.componentsByPage[pageID].add(id);
        this.componentsByMod[modID] ??= new Set();
        this.componentsByMod[modID].add(id);
        this.logger.debug(`Component created : ${id}`);
        return id;

    }
    loadJSfile(folderName, path) {
        this.logger.debug(`Loading JS file: [${folderName}] from path: ${path}`);
        this.bridge.loadModuleFile(folderName, path);
        // Return a mock object or actual loaded object
        return {};
    }
    createDOMFromString(id, html) {
        const template = document.createElement('template');
        template.innerHTML = `<div class="component-root" id="${id}">${html}</div>`;
        return template.content.firstElementChild;
    }
}
class ComponentAgent {
    constructor(
        id, type, modID, dependenciesComponent = [],
        ComponentObject) {
        this.id = id;
        this.type = type;
        this.modID = modID;
        this.dependenciesComponent = dependenciesComponent;

        this.object = ComponentObject;
        this.html = html;


    }
}