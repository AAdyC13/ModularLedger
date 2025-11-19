/**
 * Calculator Component
 * 計算機組件 - 提供數字輸入和計算功能
 */
export class Calculator {
    constructor(preloadedHtml = null) {
        this.panel = null;
        this.display = null;
        this.displayValue = '0';
        this.lastOperator = null;
        this.exceptionCalculated = false;
        this.targetInput = null;
        this.templateHtml = preloadedHtml;  // 接收預載入的 HTML
        this.isInjected = false;  // 是否已注入 DOM
        this.boundHandlers = {};  // 存儲綁定的處理函數，用於解綁
    }

    /**
     * 初始化計算機
     * @param {string} targetInputId - 目標輸入框 ID
     */
    async init(targetInputId) {
        // 只在首次注入 DOM（永遠不 fetch）
        if (!this.isInjected && this.templateHtml) {
            this.injectTemplate();
            this.isInjected = true;
        }

        // 解綁舊的事件（避免重複綁定）
        this.unbindEvents();

        this.targetInput = document.getElementById(targetInputId);
        this.panel = document.getElementById('calculator-panel');
        this.display = document.getElementById('calculator-display');

        if (!this.targetInput || !this.panel || !this.display) {
            console.error('Calculator initialization failed: missing elements');
            return;
        }

        this.bindEvents();
    }

    /**
     * 注入預載入的 HTML 模板到 DOM
     */
    injectTemplate() {
        if (!this.templateHtml) {
            console.error('Calculator template not preloaded');
            return;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.templateHtml;

        while (tempDiv.firstChild) {
            document.body.appendChild(tempDiv.firstChild);
        }

        console.log('✓ Calculator template injected');
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 存儲處理函數引用以便後續解綁
        this.boundHandlers.inputClick = (e) => {
            e.stopPropagation();
            this.show();
        };

        this.boundHandlers.documentClick = (e) => {
            this.exceptionCalculated = false;
            if (!this.panel.contains(e.target) && e.target !== this.targetInput) {
                this.hide();
            }
        };

        // 顯示/隱藏計算機
        this.targetInput.addEventListener('click', this.boundHandlers.inputClick);

        // 點擊其他地方關閉
        document.addEventListener('click', this.boundHandlers.documentClick);

        // 計算機按鈕（只綁定一次到 panel，使用事件委託）
        this.boundHandlers.panelClick = (e) => {
            const btn = e.target.closest('.calc-btn');
            if (!btn || btn.disabled) return;

            e.stopPropagation();
            const value = btn.dataset.value;

            if (value >= '0' && value <= '9') {
                this.handleNumber(value);
            } else if (value === '.') {
                this.handleDecimal();
            } else if (value === 'C') {
                this.handleClear();
            } else if (value === 'del') {
                this.handleBackspace();
            } else if (['+', '-', '*', '/'].includes(value)) {
                this.handleOperator(value);
            } else if (value === '=') {
                this.handleEquals();
            }

            this.updateButtonStates();
        };

        this.panel.addEventListener('click', this.boundHandlers.panelClick);
    }

    /**
     * 解綁事件
     */
    unbindEvents() {
        if (this.targetInput && this.boundHandlers.inputClick) {
            this.targetInput.removeEventListener('click', this.boundHandlers.inputClick);
        }

        if (this.boundHandlers.documentClick) {
            document.removeEventListener('click', this.boundHandlers.documentClick);
        }

        if (this.panel && this.boundHandlers.panelClick) {
            this.panel.removeEventListener('click', this.boundHandlers.panelClick);
        }

        this.boundHandlers = {};
    }

    show() {
        this.panel.classList.add('active');
        if (this.targetInput.value && this.targetInput.value !== '0') {
            this.displayValue = this.targetInput.value;
        } else {
            this.displayValue = '0';
        }
        this.updateDisplay();
        this.updateButtonStates();
    }

    hide() {
        this.panel.classList.remove('active');
    }

    handleExceptionCalculated() {
        if (this.exceptionCalculated === true) {
            this.displayValue = this.targetInput.value || '0';
            this.exceptionCalculated = false;
        }
    }

    updateButtonStates() {
        const lastChar = this.displayValue[this.displayValue.length - 1];
        const isOperator = ['+', '-', '*', '/'].includes(lastChar);
        const isMaxLength = this.displayValue.length >= 15;

        const parts = this.displayValue.split(/[+\-*\/]/);
        const currentNumber = parts[parts.length - 1];
        const hasDecimal = currentNumber.includes('.');

        document.querySelectorAll('.calc-btn').forEach(btn => {
            const type = btn.dataset.type;

            if (!type) {
                btn.disabled = false;
                return;
            }

            if (type.includes('zero') || type.includes('non_zero')) {
                btn.disabled = isMaxLength;
            } else if (type.includes('decimal')) {
                btn.disabled = hasDecimal || isOperator || isMaxLength;
            } else if (type.includes('operator')) {
                btn.disabled = isOperator || lastChar === '.' || (isMaxLength && !isOperator);
            } else if (type.includes('calculate')) {
                btn.disabled = isOperator || lastChar === '.';
            }
        });
    }

    handleNumber(num) {
        this.handleExceptionCalculated();
        if (this.displayValue === '0') {
            this.displayValue = num;
        } else {
            this.displayValue += num;
        }
        this.updateDisplay();
    }

    handleDecimal() {
        this.handleExceptionCalculated();
        const parts = this.displayValue.split(/[+\-*\/]/);
        const lastPart = parts[parts.length - 1];
        if (!lastPart.includes('.')) {
            this.displayValue += '.';
            this.updateDisplay();
        }
    }

    handleClear() {
        this.displayValue = '0';
        this.lastOperator = null;
        this.exceptionCalculated = false;
        this.updateDisplay();
    }

    handleBackspace() {
        this.handleExceptionCalculated();
        if (this.displayValue.length > 1) {
            this.displayValue = this.displayValue.slice(0, -1);
        } else {
            this.displayValue = '0';
        }
        this.updateDisplay();
    }

    handleOperator(op) {
        this.handleExceptionCalculated();
        const lastChar = this.displayValue[this.displayValue.length - 1];
        if (['+', '-', '*', '/'].includes(lastChar)) {
            this.displayValue = this.displayValue.slice(0, -1) + op;
        } else {
            this.displayValue += op;
        }
        this.lastOperator = op;
        this.updateDisplay();
    }

    checkAndRoundDecimals(numValue) {
        let resultStr = numValue.toString();

        if (resultStr.includes('e')) {
            resultStr = numValue.toFixed(20).replace(/\.?0+$/, '');
        }

        const decimalIndex = resultStr.indexOf('.');
        let needsRounding = false;

        if (decimalIndex !== -1) {
            const decimalPart = resultStr.substring(decimalIndex + 1);
            needsRounding = decimalPart.length > 2;
        }

        if (needsRounding) {
            const roundedTo2 = Math.round(numValue * 100) / 100;
            this.displayValue = `ANS ≒ ${roundedTo2}`;
            this.targetInput.value = Math.abs(roundedTo2).toString();
            this.exceptionCalculated = true;
            return true;
        }

        return false;
    }

    handleEquals(shouldClose = true) {
        this.handleExceptionCalculated();
        const hasOperator = /[+\-*/]/.test(this.displayValue.substring(1)) ||
            (this.displayValue.length > 1 && /[+*/]/.test(this.displayValue));

        if (!hasOperator) {
            const numValue = parseFloat(this.displayValue);
            if (isNaN(numValue) || !isFinite(numValue)) {
                this.targetInput.value = '0';
            } else {
                if (this.checkAndRoundDecimals(numValue)) {
                    this.updateDisplay();
                    if (shouldClose) this.hide();
                    return;
                }

                if (numValue < 0) {
                    this.targetInput.value = Math.abs(numValue).toString();
                } else {
                    this.targetInput.value = this.displayValue;
                }
            }

            if (shouldClose) this.hide();
            return;
        }

        try {
            const result = eval(this.displayValue);
            let numValue = parseFloat(result);

            if (isNaN(numValue) || !isFinite(numValue)) {
                this.displayValue = 'Error';
                this.targetInput.value = '0';
                this.exceptionCalculated = true;
                this.updateDisplay();
                return;
            }

            const absValue = Math.abs(numValue);

            if (absValue > 1e12) {
                this.displayValue = 'ANS > 10^12';
                this.targetInput.value = '0';
                this.exceptionCalculated = true;
                this.updateDisplay();
                return;
            }

            if (this.checkAndRoundDecimals(numValue)) {
                this.updateDisplay();
                return;
            }

            this.displayValue = numValue.toString();
            this.lastOperator = null;

            if (numValue < 0) {
                this.targetInput.value = Math.abs(numValue).toString();
            } else {
                this.targetInput.value = this.displayValue;
            }

            this.updateDisplay();
        } catch (e) {
            this.displayValue = 'Error';
            this.targetInput.value = '0';
            this.exceptionCalculated = true;
            this.updateDisplay();
        }
    }

    updateDisplay() {
        this.display.textContent = this.displayValue;
        this.updateButtonStates();
    }
}