(function() {
    // 防止重複注入
    if (window.__loggerPolyfillInjected) return;
    window.__loggerPolyfillInjected = true;

    var originalMethods = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };

    function serializeArgs(args) {
        return Array.from(args).map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    // 縮排 2 格，讓 Logcat 裡的 JSON 比較好讀，但會增加長度
                    // 如果追求省空間，可以去掉後兩個參數: JSON.stringify(arg)
                    return JSON.stringify(arg, null, 2); 
                } catch (e) {
                    return '[Circular/Unserializable Object]';
                }
            }
            return String(arg);
        }).join(' ');
    }

    console.log = function() { originalMethods.log(serializeArgs(arguments)); };
    console.warn = function() { originalMethods.warn(serializeArgs(arguments)); };
    console.error = function() { originalMethods.error(serializeArgs(arguments)); };
    console.info = function() { originalMethods.log(serializeArgs(arguments)); }; // Info 視同 Log
})();
