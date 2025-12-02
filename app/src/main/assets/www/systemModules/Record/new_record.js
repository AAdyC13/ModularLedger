/**
 * New Record Page
 * 記帳頁面邏輯 - 支援支出/收入/轉帳三種模式
 */
import { BasePage } from './BasePage.js';

export class NewRecordPage extends BasePage {
    constructor(router) {
        super(router);
        this.recordType = 0; // 0=支出, 1=收入, 2=轉帳
        this.scrollController = null;
        this.recordMain = null;
        this.recordForm = null;
        this.recordScrollbarThumb = null;

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

    /**
     * 初始化頁面
     */
    async init() {
        await super.init();

        // 獲取 DOM 引用
        this.recordMain = document.getElementById('record-main');
        this.recordScrollbarThumb = document.getElementById('record-scrollbar-thumb');

        // 綁定事件
        this.bindEvents();

        // 載入默認子介面（支出）
        await this.loadSubInterface(0);
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 返回按鈕
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            this.addEventListener(backBtn, 'click', (e) => {
                e.preventDefault();
                this.navigate('pages/home.html');
            });
        }

        // 儲存按鈕
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            this.addEventListener(saveBtn, 'click', (e) => {
                e.preventDefault();
                this.saveRecord();
            });
        }

        // 再記一筆按鈕
        const addAnotherBtn = document.getElementById('add-another-btn');
        if (addAnotherBtn) {
            this.addEventListener(addAnotherBtn, 'click', (e) => {
                e.preventDefault();
                this.addAnotherRecord();
            });
        }

        // 記錄類型按鈕
        const typeBtns = document.querySelectorAll('.record-type-btn');
        typeBtns.forEach(btn => {
            this.addEventListener(btn, 'click', async (e) => {
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
        const tempSaveBtn = document.getElementById('temp-save-btn');
        if (tempSaveBtn) {
            this.addEventListener(tempSaveBtn, 'click', (e) => {
                e.preventDefault();
                this.tempSaveRecord();
            });
        }
    }

    /**
     * 更新記錄類型按鈕狀態
     */
    updateRecordTypeButtons() {
        document.querySelectorAll('.record-type-btn').forEach(btn => {
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
        const oldScrollbar = this.recordScrollbarThumb ? this.recordScrollbarThumb.parentElement : null;

        // 清理舊的 ScrollController（但保留 DOM 用於動畫）
        if (this.scrollController) {
            this.scrollController.destroy();
            this.scrollController = null;
        }

        // 重置 ID 映射
        this.fieldIdMap = {};

        // 根據類型生成對應的表單 HTML
        const formHtml = this.generateFormHtml(type);

        // 創建新表單容器
        const newFormContainer = document.createElement('div');
        newFormContainer.style.position = 'absolute';
        newFormContainer.style.top = '0';
        newFormContainer.style.left = '0';
        newFormContainer.style.width = '100%';
        newFormContainer.style.height = '100%';
        newFormContainer.innerHTML = `
            <div class="record-form" id="record-form">
                ${formHtml}
            </div>
            <div class="record-scrollbar">
                <div class="record-scrollbar-thumb" id="record-scrollbar-thumb"></div>
            </div>
        `;

        // 確保 record-main 使用相對定位
        this.recordMain.style.position = 'relative';

        // 如果是首次載入，直接替換內容
        if (!oldForm) {
            this.recordMain.innerHTML = '';
            this.recordMain.appendChild(newFormContainer);
            newFormContainer.style.position = 'static';

            // 重新獲取 DOM 引用
            this.recordForm = document.getElementById('record-form');
            this.recordScrollbarThumb = document.getElementById('record-scrollbar-thumb');

            // 初始化滾動
            this.initScroll();

            // 初始化計算機
            await this.initCalculator();
            return;
        }

        // 將舊表單設為絕對定位
        if (oldForm && oldScrollbar) {
            const oldContainer = document.createElement('div');
            oldContainer.style.position = 'absolute';
            oldContainer.style.top = '0';
            oldContainer.style.left = '0';
            oldContainer.style.width = '100%';
            oldContainer.style.height = '100%';
            oldContainer.appendChild(oldForm);
            oldContainer.appendChild(oldScrollbar);
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
            newFormContainer.style.position = 'static';
        }, 300);

        // 重新獲取 DOM 引用
        this.recordForm = newFormContainer.querySelector('.record-form');
        this.recordScrollbarThumb = newFormContainer.querySelector('.record-scrollbar-thumb');

        // 初始化滾動
        this.initScroll();

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
                <div class="form-group" style="height: 25%;">
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
     * 初始化計算機
     */
    async initCalculator() {
        try {
            const calculator = this.getComponent('calculator');
            if (!calculator) return;

            // 找到當前表單中類型為 calculator 的欄位
            const fields = this.formConfigs[this.recordType] || this.formConfigs[0];
            const calculatorField = fields.find(field => field.type === 'calculator');

            if (calculatorField) {
                // 從 fieldIdMap 中查找對應的 ID
                const fieldId = this.fieldIdMap[calculatorField.name];
                if (fieldId) {
                    await calculator.init(fieldId);
                    console.log(`✓ Calculator initialized for ${calculatorField.name} (${fieldId})`);
                }
            }
        } catch (error) {
            console.error('初始化計算機失敗:', error);
        }
    }

    /**
     * 初始化滾動
     */
    initScroll() {
        if (!this.recordMain || !this.recordForm || !this.recordScrollbarThumb) return;

        // 通過組件管理器創建 ScrollController 實例
        if (this.router && this.router.componentsManager) {
            this.scrollController = this.router.componentsManager.createComponent(
                'scrollController',
                this.recordMain,
                this.recordForm,
                this.recordScrollbarThumb
            );
        }
    }

    /**
     * 儲存記錄
     */
    saveRecord() {
        console.log('儲存記錄, 類型:', this.recordType);
        // TODO: 實作儲存邏輯

        // 儲存後返回首頁
        this.navigate('pages/home.html');
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
        // 清理 ScrollController
        if (this.scrollController) {
            this.scrollController.destroy();
            this.scrollController = null;
        }

        super.destroy();
    }
}
