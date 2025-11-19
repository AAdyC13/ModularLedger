function init() {
    registerUIComponent('minimal-label', (container) => {
        const p = document.createElement('p');
        p.innerText = "Minimal Plugin Loaded";
        container.appendChild(p);
    });
}

window.PluginManager.register({ init });