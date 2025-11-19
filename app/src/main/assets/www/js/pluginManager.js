// pluginManager.js
const PluginManager = {
    plugins: [],

    register(plugin) {
        this.plugins.push(plugin);
        if (plugin.init) plugin.init();
    },

    loadPlugin(pluginPath) {
        // 載入 CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = pluginPath + '/style.css';
        document.head.appendChild(link);

        // 載入 JS
        const script = document.createElement('script');
        script.src = pluginPath + '/plugin.js';
        script.onload = () => console.log(`Plugin loaded: ${pluginPath}`);
        document.body.appendChild(script);
    }
};

// 提供給 plugin 註冊 UI 元件的 API
function registerUIComponent(name, renderFunc) {
    const area = document.getElementById('plugin-area');
    const wrapper = document.createElement('div');
    wrapper.id = name;
    area.appendChild(wrapper);
    renderFunc(wrapper);
}

// 暴露給全局使用
window.PluginManager = PluginManager;
window.registerUIComponent = registerUIComponent;