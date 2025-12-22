import { Calculator } from '../../components/Calculator/Calculator.js';

export default class Recorder {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.containerChecked = false;

        this.recordMain = null;
        this.recordType = "expense";
        this.counter = 0;
        this.recordForm = null;
        this.calculator = null; // 新增：儲存計算機實例

        this.formConfigs = [
            {
                formName: "expense",
                fields: [
                    { name: "時間", type: "datetime-local" },
                    { name: "金額", type: "number", placeholder: "支出金額" },
                    { name: "類別", type: "text", placeholder: "支出類別" },
                    { name: "帳戶", type: "text", placeholder: "支出帳戶" },
                    { name: "地點", type: "text", placeholder: "消費地點（可選）" },
                    { name: "備註", type: "text", placeholder: "新增備註（可選）" },
                ]
            },
            {
                formName: "income",
                fields: [
                    { name: "時間", type: "datetime-local" },
                    { name: "金額", type: "number", placeholder: "收入金額" },
                    { name: "類別", type: "text", placeholder: "收入類別" },
                    { name: "帳戶", type: "text", placeholder: "收入帳戶" },
                    { name: "備註", type: "text", placeholder: "新增備註（可選）" }
                ]
            },
            {
                formName: "transfer",
                fields: [
                    { name: "時間", type: "datetime-local" },
                    { name: "金額", type: "number", placeholder: "轉帳金額" },
                    { name: "類別", type: "text", placeholder: "轉帳類型" },
                    { name: "來源帳戶", type: "text", placeholder: "來源帳戶" },
                    { name: "目標帳戶", type: "text", placeholder: "目標帳戶" },
                    { name: "備註", type: "text", placeholder: "新增備註（可選）" }
                ]
            }
        ];

        // 自動生成的 ID 映射（運行時生成）
        this.fieldIdMap = {};
    }

    /**
     * 獲取表單配置的索引
     * @param {string} formName - 表單名稱
     * @returns {number} 索引，-1 如果未找到
     */
    getFormIndex(formName) {
        return this.formConfigs.findIndex(config => config.formName === formName);
    }

    async init(Agent) {
        this.Agent = Agent;
        this.logger = Agent.tools.logger;
        this.eventPlatform = Agent.eventPlatform;
        this.setOnEvents();
        this.logger.debug(`Recorder initialized`);
        
        // 建議：在此處呼叫 setupCalculator，否則 calculator 永遠是 null
        // await this.setupCalculator(); 
        
        return true;
    }


    /**
     * 新增：設定並載入計算機組件
     */
    async setupCalculator() {
        try {
            // 載入計算機 HTML 模板 (路徑相對於 index.html)
            const response = await fetch('components/Calculator/Calculator.html');
            if (!response.ok) throw new Error('Failed to fetch Calculator.html');
            const html = await response.text();
            
            // 實例化計算機並注入模板
            this.calculator = new Calculator(html);
            this.calculator.injectTemplate();
            this.logger.debug('Calculator setup complete');
        } catch (e) {
            this.logger.error('Failed to load calculator: ' + e.message);
        }
    }

    /**
     * 綁定事件
     */
    setOnEvents() {
        this.eventPlatform.on("save-btn", () => {
            if (!this.containerChecked) return;
            this.saveRecord();
        });
        this.eventPlatform.on("add-another-btn", () => {
            if (!this.containerChecked) return;
            this.addAnotherRecord()
        });
        this.eventPlatform.on("expense-btn", () => {
            if (!this.containerChecked) return;
            this.recordTypeBtn("expense");
        });
        this.eventPlatform.on("income-btn", () => {
            if (!this.containerChecked) return;
            this.recordTypeBtn("income");
        });
        this.eventPlatform.on("transfer-btn", () => {
            if (!this.containerChecked) return;
            this.recordTypeBtn("transfer");
        });
        this.eventPlatform.on("temp-save-btn", () => {
            if (!this.containerChecked) return;
            this.tempSaveRecord();
        });

        this.eventPlatform.on("authorizeRecorder_view", (data) => {
            if (!data.dom) {
                this.logger.warn('Recorder authorize view DOM not provided');
                return;
            }
            if (!this.containerChecked) {
                this.container = data.dom;
                this.recordMain = this.container.querySelector('#record-main');
                this.loadSubInterface("expense"); // 載入默認子介面（支出）
                this.containerChecked = true;
            }
        });
    }

    async recordTypeBtn(newType) {
        // 由於表單按鈕禁用未實作，這邊先放保底
        if (this.recordType === newType) return;
        await this.loadSubInterface(newType);
        this.updateRecordTypeButtons(this.recordType);
        this.recordType = newType;
        // this.logger.debug(`Record type changed to ${newType}`);
    }

    /**
     * 更新記錄類型按鈕狀態
     */
    updateRecordTypeButtons(oldType) {
        // 警告! 這邊應該透過 Agent API 由系統控制菜單按鈕狀態
    }

    /**
     * 載入子介面
     */
    async loadSubInterface(formName) {
        const index = this.getFormIndex(formName);
        if (index === -1) return;
        // 判斷滑動方向（根據 formConfigs 的 Array key 順序）
        const oldIndex = this.getFormIndex(this.recordType);
        const slideDirection = index > oldIndex ? 'left' : 'right';

        // 保存舊的表單元素
        const oldFormContainer = this.recordFormContainer;
        // 重置 ID 映射
        this.fieldIdMap = {};

        // 根據類型生成對應的表單 HTML
        const formHtml = this.generateFormHtml(index);

        // 創建新表單容器
        this.counter += 1;
        const newFormContainer = document.createElement('div');
        newFormContainer.classList.add('record-form-container');
        newFormContainer.innerHTML = `
            <div class="record-form" id="record-form">
                ${formHtml}
            </div>`;

        // 確保 record-main 使用相對定位
        // this.recordMain.classList.add('relative');

        // 如果是首次載入，直接替換內容
        if (!oldFormContainer) {
            this.recordMain.innerHTML = '';
            this.recordMain.appendChild(newFormContainer);
            newFormContainer.classList.add('static');

            // 重新獲取 DOM 引用
            this.recordFormContainer = newFormContainer;

            // 初始化計算機
            // await this.initCalculator();
            return;
        }

        // ---- 改為使用 track 推動 old -> new（平推效果、無重疊） ----
        const track = document.createElement('div');
        track.classList.add('record-track');

        // 把目前的 old 從 recordMain 移到 track
        if (oldFormContainer.parentElement === this.recordMain) {
            this.recordMain.removeChild(oldFormContainer);
        }

        // 根據滑動方向決定 DOM 順序，確保動畫邏輯正確
        if (slideDirection === 'left') {
            // 新表單在右邊：[Old] [New]
            track.appendChild(oldFormContainer);
            track.appendChild(newFormContainer);
        } else {
            // 新表單在左邊：[New] [Old]
            track.appendChild(newFormContainer);
            track.appendChild(oldFormContainer);
        }

        // 把整個 track 放回 recordMain
        this.recordMain.innerHTML = '';
        this.recordMain.appendChild(track);

        // 強制 reflow，確保 CSS transition 可觸發
        void track.getBoundingClientRect();

        if (slideDirection === 'left') {
            // 新表單在右邊 -> 從 0 推到 -50%（track 寬 200%，-50% 等於把畫面右移一個子項寬度）
            track.style.transform = 'translateX(-50%)';
        } else {
            // 新表單在左邊 -> 從 -50% 推到 0
            // 1. 先瞬間設定到 -50% (顯示 Old)，並暫時取消過渡效果以防閃爍
            track.style.transition = 'none';
            track.style.transform = 'translateX(-50%)';

            // 2. 強制 reflow 讓設定生效
            void track.getBoundingClientRect();

            // 3. 恢復過渡效果並設定目標為 0 (顯示 New)
            track.style.transition = '';
            track.style.transform = 'translateX(0)';
        }

        // 動畫結束後清理：把 new 放回 recordMain，恢復 static，並回收 old
        // 警告! 這種"動畫結束後再執行邏輯"的工具，應該由系統提供，目前EM已經有硬編碼此功能。
        setTimeout(() => {
            // 清空 recordMain 並只放 newFormContainer（恢復正常 DOM 結構）
            this.recordMain.innerHTML = '';
            newFormContainer.classList.add('static');
            // 移除可能的 inline transform on new/new children
            newFormContainer.style.transform = '';
            this.recordMain.appendChild(newFormContainer);

            // 重新獲取 DOM 引用
            this.recordFormContainer = newFormContainer;
        }, 400);
        // ---- end track 推動邏輯 ----

        // 初始化計算機（金額欄位）
        // await this.initCalculator();
    }

    /**
     * 生成唯一的欄位 ID
     * @param {number} index - 表單索引
     * @param {number} fieldIndex - 欄位索引
     * @param {Object} field - 欄位配置
     * @returns {string} 唯一 ID
     */
    generateFieldId(index, fieldIndex, field) {
        const id = `field-${index}-${fieldIndex}`;
        // 記錄映射關係（欄位名稱 -> ID）
        this.fieldIdMap[field.name] = id;
        return id;
    }

    /**
     * 根據類型生成表單 HTML
     * @param {number} index - 表單索引
     * @returns {string} 表單 HTML
     */
    generateFormHtml(index) {
        const config = this.formConfigs[index];
        if (!config) return '';
        const fields = config.fields;

        return fields.map((field, fieldIndex) => {
            const fieldId = this.generateFieldId(index, fieldIndex, field);
            const inputHtml = this.generateFieldInput(field, fieldId);
            return `
                <div class="form-group record-field">
                    <label class="form-label sys-label" for="${fieldId}">${field.name}</label>
                    ${inputHtml}
                </div>
            `;
        }).join('');
    }

    /**
     * 根據欄位配置生成 input HTML
     * @param {Object} field - 欄位配置 { name, type, placeholder? }
     * @param {string} fieldId - 自動生成的唯一 ID
     * @returns {string} input HTML
     */
    generateFieldInput(field, fieldId) {
        const placeholder = field.placeholder || `請輸入${field.name}`;
        const className = 'form-input sys-input';

        switch (field.type) {
            case 'calculator':
                // Calculator 類型：readonly text input
                return `<input type="text" id="${fieldId}" class="${className}" placeholder="${placeholder}" readonly />`;

            case 'datetime-local':
                // 時間類型
                return `<input type="datetime-local" id="${fieldId}" class="${className}" />`;
            case 'number':
                // 數字類型
                return `<input type="number" id="${fieldId}" class="${className}" placeholder="${placeholder}" />`;
            case 'text':
            default:
                // 一般文字輸入
                return `<input type="text" id="${fieldId}" class="${className}" placeholder="${placeholder}" />`;
        }
    }

    /**
     * 初始化計算機 (修正版)
     */
    async initCalculator() {
        try {
            if (!this.calculator) {
                this.logger.warn('Calculator not ready yet');
                return;
            }

            // 找到當前表單中類型為 calculator 的欄位
            const index = this.getFormIndex(this.recordType);
            if (index === -1) return;
            const fields = this.formConfigs[index].fields;
            const calculatorField = fields.find(field => field.type === 'calculator');

            if (calculatorField) {
                // 從 fieldIdMap 中查找對應的 ID
                const fieldId = this.fieldIdMap[calculatorField.name];
                if (fieldId) {
                    await this.calculator.init(fieldId);
                    console.log(`✓ Calculator initialized for ${calculatorField.name} (${fieldId})`);
                }
            }
        } catch (error) {
            console.error('初始化計算機失敗:', error);
        }
    }

    /**
     * 儲存記錄
     */
    saveRecord() {
        console.log('儲存記錄, 類型:', this.recordType);
        // TODO: 實作儲存邏輯

        // 儲存後返回首頁
        // this.navigate('pages/home.html');
    }

    /**
     * 暫存記錄
     */
    tempSaveRecord() {
        console.log('暫存記錄, 類型:', this.recordType);
        // TODO: 實作暫存邏輯
    }

    /**
     * 再記一筆
     */
    addAnotherRecord() {
        console.log('再記一筆');
        // TODO: 清空表單或重新載入
    }

    /**
     * 頁面銷毀（cache: false 時調用）
     */
    destroy() {
    }
}