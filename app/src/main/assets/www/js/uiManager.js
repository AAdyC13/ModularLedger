let uiManagerInstance = null;

export default class UIManager {
    constructor() {
        this.logger = null;
        this.eventHub = null;
        this.toastContainer = null;
        if (uiManagerInstance) {
            return uiManagerInstance;
        }
        uiManagerInstance = this;
        this.isInitialized = false;
    }

    init(logger, eventHub) {
        this.logger = logger;
        this.eventHub = eventHub;

        // 建立 Toast 容器
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'sys-toast-container';
        document.body.appendChild(this.toastContainer);
        this.isInitialized = true;
        this.logger.debug('UIManager initialized');
    }

    createAgent(moduleName) {
        if (!this.isInitialized) {
            throw new Error('UIManager has not been initialized. Call init() first.');
        }
        return new UIAgent(this, moduleName);
    }

    /**
     * 顯示一個 Toast 提示訊息
     * @param {object} options - 選項 { message, type, duration }
     * @param {string} moduleName - 呼叫此方法的模組名稱
     */
    showToast({ message, type = 'info', duration = 4000 }, moduleName) {
        if (!message) return;

        const toast = document.createElement('div');
        toast.className = `sys-toast toast-${type}`;

        const time = new Date().toLocaleTimeString('it-IT'); // HH:mm:ss format

        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-module">${moduleName}</span>
                <span class="toast-time">${time}</span>
            </div>
            <div class="toast-body">${message}</div>
        `;

        this.toastContainer.appendChild(toast);

        // 動畫結束後移除
        const removeToast = () => {
            toast.classList.add('fade-out');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        };

        setTimeout(removeToast, duration);
    }

    /**
     * 顯示一個強制模態視窗
     * @param {object} options - 選項 { name, msg, type, config }
     * @param {string} moduleName - 呼叫此方法的模組名稱
     */
    showModal({ name, msg, type = 'alert', config = {} }, moduleName) {
        const overlay = document.createElement('div');
        overlay.className = 'sys-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'sys-modal';

        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${name || ''}</h3>
            </div>
            <div class="modal-body">
                <p class="modal-message">${msg || ''}</p>
                <div class="modal-content"></div>
            </div>
            <div class="modal-footer"></div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            modal.classList.add('visible');
        });

        const closeModal = () => {
            overlay.classList.remove('visible');
            modal.classList.remove('visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        };

        switch (type) {
            case 'alert':
                return new Promise(resolve => {
                    const footer = modal.querySelector('.modal-footer');
                    const okButton = document.createElement('button');
                    okButton.className = 'modal-button';
                    okButton.textContent = config.buttonText || '確認';
                    footer.appendChild(okButton);
                    okButton.onclick = () => {
                        closeModal();
                        resolve(true);
                    };
                });

            case 'prompt':
                return new Promise(resolve => {
                    modal.querySelector('.modal-content').innerHTML = `
                        <input type="text" class="modal-input" placeholder="${config.placeholder || ''}">
                    `;
                    const input = modal.querySelector('.modal-input');

                    const footer = modal.querySelector('.modal-footer');
                    const okButton = document.createElement('button');
                    okButton.className = 'modal-button';
                    okButton.textContent = config.okText || '確認';
                    footer.appendChild(okButton);

                    const cancelButton = document.createElement('button');
                    cancelButton.className = 'modal-button secondary';
                    cancelButton.textContent = config.cancelText || '取消';
                    footer.appendChild(cancelButton);

                    okButton.onclick = () => {
                        closeModal();
                        const data = input.value;
                        this.logger.debug(`Prompt modal [${name}] from [${moduleName}] returned: ${data}`);
                        resolve(data);
                    };
                    cancelButton.onclick = () => {
                        closeModal();
                        resolve(null);
                    };
                    input.focus();
                });

            case 'wait':
                modal.querySelector('.modal-content').innerHTML = '<div class="modal-spinner"></div>';
                modal.querySelector('.modal-footer').remove(); // 'wait' modal has no footer

                const timeout = config.timeout || 15000;

                const timeoutId = setTimeout(() => {
                    this.logger.warn(`Modal [${name}] from [${moduleName}] timed out after ${timeout}ms.`);
                    closeModal();
                }, timeout);

                return {
                    close: () => {
                        clearTimeout(timeoutId);
                        closeModal();
                    }
                };

            default:
                this.logger.error(`Unknown modal type: ${type}`);
                closeModal();
                return Promise.resolve(null);
        }
    }
}

export const uiManager = new UIManager();

export class UIAgent {
    constructor(manager, moduleName) {
        this.manager = manager;
        this.moduleName = moduleName || 'Unknown';
    }

    /**
     * 顯示一個從角落滑入的提示訊息
     * @param {string} message - 要顯示的訊息
     * @param {string} [type='info'] - 訊息類型 ('info', 'warn', 'error', 'success')
     * @param {number} [duration=3] - 顯示持續時間（秒）
     */
    showToast(message, type = 'info', duration = 3) {
        return this.manager.showToast({ message, type, duration: duration * 1000 }, this.moduleName);
    }

    /**
     * 顯示一個警告/確認提示框
     * @param {string} name - 標題
     * @param {string} msg - 訊息內容
     * @param {string} [buttonText='確認'] - 按鈕上顯示的文字
     * @returns {Promise<boolean>} - 使用者點擊按鈕後解析
     */
    alert(name, msg, buttonText) {
        const config = {
            buttonText: buttonText || '確認'
        };
        return this.manager.showModal({ name, msg, type: 'alert', config }, this.moduleName);
    }

    /**
     * 顯示一個帶有輸入框的提示框
     * @param {string} name - 標題
     * @param {string} msg - 訊息內容
     * @param {string} [placeholder=''] - 輸入框的預留位置文字
     * @param {string} [okText='確認'] - 確認按鈕的文字
     * @param {string} [cancelText='取消'] - 取消按鈕的文字
     * @returns {Promise<string|null>} - 使用者確認後解析為輸入的文字，取消則為 null
     */
    prompt(name, msg, placeholder, okText, cancelText) {
        const config = {
            placeholder: placeholder || '',
            okText: okText || '確認',
            cancelText: cancelText || '取消',
        }
        return this.manager.showModal({ name, msg, type: 'prompt', config }, this.moduleName);
    }

    /**
     * 顯示一個等待提示框
     * @param {string} name - 標題
     * @param {string} msg - 訊息內容
     * @param {number} [timeout=3] - 最長等待時間（秒），時間到將自動關閉
     * @returns {{close: function}} - 一個包含 close 方法的物件，用於手動關閉提示框
     */
    wait(name, msg, timeout = 3) {
        const config = {
            timeout: timeout * 1000
        };
        return this.manager.showModal({ name, msg, type: 'wait', config }, this.moduleName);
    }
}
