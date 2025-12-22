import { Calculator } from '../../components/Calculator/Calculator.js';

export default class Recorder {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        this.recordMain = null;

        this.recordType = 0; // 0=支出, 1=收入, 2=轉帳

        this.recordForm = null;
        this.calculator = null; // 新增：儲存計算機實例

        // 定義各模式的欄位配置
        this.formConfigs = {
            0: [ // 支出
                { name: "時間", type: "datetime-local" },
                { name: "金額", type: "calculator", placeholder: "點擊輸入金額" },
                { name: "類別", type: "text", placeholder: "選擇類別" },
                { name: "帳戶", type: "text", placeholder: "選擇帳戶" },
                { name: "地點", type: "text", placeholder: "輸入地點（可選）" },
                { name: "備註", type: "text", placeholder: "新增備註（可選）" },
                // 測試滾動用的額外欄位
                { name: "輸入7", type: "text" },
                { name: "輸入8", type: "text" },
                { name: "輸入9", type: "text" },
                { name: "輸入10", type: "text" },
                { name: "輸入11", type: "text" },
                { name: "輸入12", type: "text" },
                { name: "輸入13", type: "text" },
                { name: "輸入14", type: "text" }
            ],
            1: [ // 收入
                { name: "時間", type: "datetime-local" },
                { name: "金額", type: "calculator", placeholder: "點擊輸入金額" },
                { name: "類別", type: "text", placeholder: "選擇收入類別" },
                { name: "帳戶", type: "text", placeholder: "選擇帳戶" },
                { name: "地點", type: "text", placeholder: "輸入地點（可選）" },
                { name: "備註", type: "text", placeholder: "新增備註（可選）" }
            ],
            2: [ // 轉帳
                { name: "時間", type: "datetime-local" },
                { name: "金額", type: "calculator", placeholder: "點擊輸入金額" },
                { name: "類別", type: "text", placeholder: "轉帳類型" },
                { name: "帳戶", type: "text", placeholder: "選擇來源帳戶" },
                { name: "地點", type: "text", placeholder: "選擇目標帳戶" },
                { name: "備註", type: "text", placeholder: "新增備註（可選）" }
            ]
        };

        // 自動生成的 ID 映射（運行時生成）
        this.fieldIdMap = {};
    }

    async init(Agent) {
        this.Agent = Agent;
        this.logger = Agent.tools.logger;
        this.eventPlatform = Agent.eventPlatform;
        
        // 修正：增加 fallback，若 Agent.myDOM 為空則嘗試從 document 查找
        this.recordMain = (Agent.myDOM || document).querySelector("#record-main");
        
        if (!this.recordMain) {
            this.logger.error('Recorder container not found!');
            return false;
        }

        // 新增：初始化計算機
        await this.setupCalculator();

        this.bindEvents(); // 綁定事件
        await this.loadSubInterface(0); // 載入默認子介面（支出）
        this.logger.debug(`Recorder initialized`);
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
    bindEvents() {
        // 返回按鈕
        const backBtn = this.recordMain.querySelector("#back-btn");
        if (backBtn) {
            // 注意：使用 Agent.interface 時可能需要用 this.addEventListener 包裝，但這裡直接用原生即可
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // this.navigate('pages/home.html');
            });
        }

        // 儲存按鈕
        const saveBtn = this.recordMain.querySelector("#save-btn");
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveRecord();
            });
        }

        // 再記一筆按鈕
        const addAnotherBtn = this.recordMain.querySelector("#add-another-btn");
        if (addAnotherBtn) {
            addAnotherBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addAnotherRecord();
            });
        }

        // 記錄類型按鈕
        const typeBtns = this.recordMain.querySelectorAll('.record-type-btn');
        typeBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const newType = parseInt(btn.dataset.type);
                if (newType !== this.recordType) {
                    await this.loadSubInterface(newType);
                    this.recordType = newType;
                    this.updateRecordTypeButtons();
                    console.log('切換記錄類型:', this.recordType);
                }
            });
        });

        // 暫存按鈕
        const tempSaveBtn = this.recordMain.querySelector('#temp-save-btn');
        if (tempSaveBtn) {
            tempSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.tempSaveRecord();
            });
        }
    }

    /**
     * 更新記錄類型按鈕狀態
     */
    updateRecordTypeButtons() {
        this.recordMain.querySelectorAll('.record-type-btn').forEach(btn => {
            const btnType = parseInt(btn.dataset.type);
            if (btnType === this.recordType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 載入子介面
     * @param {number} type - 0=支出, 1=收入, 2=轉帳
     */
    async loadSubInterface(type) {
        if (!this.recordMain) return;

        // 判斷滑動方向（根據類型順序：0=支出, 1=收入, 2=轉帳）
        const oldType = this.recordType;
        const slideDirection = type > oldType ? 'left' : 'right';

        // 保存舊的表單元素
        const oldForm = this.recordForm;

        // 重置 ID 映射
        this.fieldIdMap = {};

        // 根據類型生成對應的表單 HTML
        const formHtml = this.generateFormHtml(type);

        // 創建新表單容器
        const newFormContainer = document.createElement('div');
        newFormContainer.classList.add('absolute-full');
        newFormContainer.innerHTML = `
            <div class="record-form" id="record-form">
                ${formHtml}
            </div>`;

        // 確保 record-main 使用相對定位
        this.recordMain.classList.add('relative');

        // 如果是首次載入，直接替換內容
        if (!oldForm) {
            this.recordMain.innerHTML = '';
            this.recordMain.appendChild(newFormContainer);
            newFormContainer.classList.add('static');

            // 重新獲取 DOM 引用
            this.recordForm = this.recordMain.querySelector('#record-form');

            // 初始化計算機
            await this.initCalculator();
            return;
        }

        // 將舊表單設為絕對定位
        if (oldForm) {
            const oldContainer = document.createElement('div');
            oldContainer.classList.add('absolute-full');
            oldContainer.appendChild(oldForm);
            this.recordMain.appendChild(oldContainer);

            // 添加退出動畫
            oldContainer.classList.add(`page-exit-slide-${slideDirection}`);

            // 動畫結束後移除舊容器
            setTimeout(() => {
                if (oldContainer.parentElement) {
                    oldContainer.remove();
                }
            }, 300);
        }

        // 添加新表單到容器
        this.recordMain.appendChild(newFormContainer);

        // 添加進入動畫
        newFormContainer.classList.add(`page-enter-slide-${slideDirection}`);

        // 動畫結束後移除動畫 class 並恢復靜態定位
        setTimeout(() => {
            newFormContainer.classList.remove('page-enter-slide-left', 'page-enter-slide-right');
            newFormContainer.classList.add('static');
        }, 300);

        // 重新獲取 DOM 引用
        this.recordForm = newFormContainer.querySelector('.record-form');

        // 初始化計算機（金額欄位）
        await this.initCalculator();
    }

    /**
     * 生成唯一的欄位 ID
     * @param {number} type - 表單類型
     * @param {number} index - 欄位索引
     * @param {Object} field - 欄位配置
     * @returns {string} 唯一 ID
     */
    generateFieldId(type, index, field) {
        const id = `field-${type}-${index}`;
        // 記錄映射關係（欄位名稱 -> ID）
        this.fieldIdMap[field.name] = id;
        return id;
    }

    /**
     * 根據類型生成表單 HTML
     * @param {number} type - 0=支出, 1=收入, 2=轉帳
     * @returns {string} 表單 HTML
     */
    generateFormHtml(type) {
        const fields = this.formConfigs[type] || this.formConfigs[0];

        return fields.map((field, index) => {
            const fieldId = this.generateFieldId(type, index, field);
            const inputHtml = this.generateFieldInput(field, fieldId);
            return `
                <div class="form-group record-field">
                    <label for="${fieldId}">${field.name}</label>
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

        switch (field.type) {
            case 'calculator':
                // Calculator 類型：readonly text input
                return `<input type="text" id="${fieldId}" class="form-input" placeholder="${placeholder}" readonly />`;

            case 'datetime-local':
                // 時間類型
                return `<input type="datetime-local" id="${fieldId}" class="form-input" />`;

            case 'text':
            default:
                // 一般文字輸入
                return `<input type="text" id="${fieldId}" class="form-input" placeholder="${placeholder}" />`;
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
            const fields = this.formConfigs[this.recordType] || this.formConfigs[0];
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