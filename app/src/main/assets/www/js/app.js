// 初始化 Framework7
const app = new Framework7({
    root: '#app',
    name: 'HybridApp',
    id: 'com.example.hybrid',
    theme: 'auto',
});

// 載入插件
PluginManager.loadPlugin('plugins/darkmode');
PluginManager.loadPlugin('plugins/minimal');