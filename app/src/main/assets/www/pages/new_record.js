/**
 * New Record Page
 * 記帳頁面邏輯
 */
export class NewRecordPage {
    constructor(router) {
        this.router = router;
        this.recordType = 0; // 0=支出, 1=收入, 2=轉帳
        this.isDragging = false;
        this.startY = 0;
        this.scrollTop = 0;
        this.contentHeight = 0;
        this.containerHeight = 0;
        this.maxScroll = 0;

        this.init();
    }

    /**
     * 初始化頁面
     */
    async init() {
        // 載入計算機組件
        await this.loadCalculator();

        // 綁定事件
        this.bindEvents();

        // 初始化滾動
        this.initScroll();
    }

    /**
     * 載入計算機組件
     */
    async loadCalculator() {
        try {
            const response = await fetch('../components/Calculator.html');
            const html = await response.text();

            const mountPoint = document.getElementById('calculator-mount-point');
            if (mountPoint) {
                mountPoint.innerHTML = html;

                // 執行計算機腳本
                const scripts = mountPoint.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    if (script.src) {
                        newScript.src = script.src;
                    } else {
                        newScript.textContent = script.textContent;
                    }
                    document.body.appendChild(newScript);
                    script.remove();
                });

                // 初始化計算機
                if (window.Calculator) {
                    window.Calculator.init('input-2');
                }
            }
        } catch (error) {
            console.error('載入計算機失敗:', error);
        }
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 返回按鈕
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.router.back();
            });
        }

        // 儲存按鈕
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveRecord();
            });
        }

        // 再記一筆按鈕
        const addAnotherBtn = document.getElementById('add-another-btn');
        if (addAnotherBtn) {
            addAnotherBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addAnotherRecord();
            });
        }

        // 記錄類型按鈕
        document.querySelectorAll('.record-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.recordType = parseInt(btn.dataset.type);
                this.updateRecordTypeButtons();
                console.log('切換記錄類型:', this.recordType);
            });
        });

        // 暫存按鈕
        const tempSaveBtn = document.getElementById('temp-save-btn');
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
     * 初始化滾動
     */
    initScroll() {
        const recordMain = document.getElementById('record-main');
        const recordForm = document.getElementById('record-form');
        const recordScrollbarThumb = document.getElementById('record-scrollbar-thumb');

        if (!recordMain || !recordForm || !recordScrollbarThumb) return;

        // 鼠標拖動
        recordMain.addEventListener('mousedown', (e) => {
            if (e.target.closest('.form-input')) return;
            this.isDragging = true;
            this.startY = e.clientY;
            this.scrollTop = parseFloat(recordForm.style.top || 0);
            recordMain.classList.add('dragging');
            e.preventDefault();
        });

        // 觸控拖動
        recordMain.addEventListener('touchstart', (e) => {
            if (e.target.closest('.form-input')) return;
            this.isDragging = true;
            this.startY = e.touches[0].clientY;
            this.scrollTop = parseFloat(recordForm.style.top || 0);
            recordMain.classList.add('dragging');
        }, { passive: true });

        // 移動處理
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaY = e.clientY - this.startY;
            const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop + deltaY));
            recordForm.style.top = newScrollTop + 'px';
            this.scrollTop = newScrollTop;
            this.updateScrollbar();
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const deltaY = e.touches[0].clientY - this.startY;
            const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop + deltaY));
            recordForm.style.top = newScrollTop + 'px';
            this.scrollTop = newScrollTop;
            this.updateScrollbar();
        }, { passive: true });

        // 結束拖動
        const endDrag = () => {
            if (this.isDragging) {
                this.isDragging = false;
                recordMain.classList.remove('dragging');
            }
        };

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);

        // 滾輪
        recordMain.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop - delta));
            recordForm.style.top = newScrollTop + 'px';
            this.scrollTop = newScrollTop;
            this.updateScrollbar();
        }, { passive: false });

        // 監聽尺寸變化
        const observer = new ResizeObserver(() => {
            this.updateScrollbar();
        });
        observer.observe(recordMain);
        observer.observe(recordForm);

        this.updateScrollbar();
    }

    /**
     * 更新滾動條
     */
    updateScrollbar() {
        const recordMain = document.getElementById('record-main');
        const recordForm = document.getElementById('record-form');
        const recordScrollbarThumb = document.getElementById('record-scrollbar-thumb');

        if (!recordMain || !recordForm || !recordScrollbarThumb) return;

        this.contentHeight = recordForm.scrollHeight;
        this.containerHeight = recordMain.clientHeight;
        this.maxScroll = Math.max(0, this.contentHeight - this.containerHeight);

        if (this.maxScroll > 0) {
            const thumbHeight = Math.max(30, (this.containerHeight / this.contentHeight) * this.containerHeight);
            const thumbTop = (Math.abs(this.scrollTop) / this.maxScroll) * (this.containerHeight - thumbHeight);
            recordScrollbarThumb.style.height = thumbHeight + 'px';
            recordScrollbarThumb.style.top = thumbTop + 'px';
        }
    }

    /**
     * 儲存記錄
     */
    saveRecord() {
        console.log('儲存記錄, 類型:', this.recordType);
        // TODO: 實作儲存邏輯

        // 儲存後返回
        this.router.back();
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
     * 頁面清理
     */
    destroy() {
        console.log('New record page destroyed');
    }
}
