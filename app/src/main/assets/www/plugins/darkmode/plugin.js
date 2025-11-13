// plugin.js
function init() {
    console.log("Dark Mode Plugin init");
    registerUIComponent('darkmode-toggle', (container) => {
        const btn = document.createElement('button');
        btn.innerText = "切換深色模式";
        btn.onclick = () => document.body.classList.toggle('dark-theme');
        container.appendChild(btn);
    });
}

// 自動註冊
window.PluginManager.register({ init });