/**
 * SettingPanel Component
 * 設定面板組件 - 處理設定面板的開關和滾動交互
 */
export class SettingPanel {
    constructor() {
        this.settingPanel = null;
        this.settingOverlay = null;
        this.settingContent = null;
        this.settingContentInner = null;
        this.scrollbarThumb = null;

        this.isDragging = false;
        this.startY = 0;
        this.scrollTop = 0;
        this.contentHeight = 0;
        this.containerHeight = 0;
        this.maxScroll = 0;

        this.init();
    }

    /**
     * 初始化組件
     */
    async init() {
        // 載入 HTML 模板
        await this.loadTemplate();

        // 獲取 DOM 元素
        this.initElements();

        // 綁定事件
        this.bindEvents();

        // 初始化滾動條
        this.initScrollbar();
    }

    /**
     * 載入 HTML 模板
     */
    async loadTemplate() {
        try {
            const response = await fetch('components/SettingPanel.html');
            const html = await response.text();

            // 將模板插入到 body 中
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // 將所有子元素添加到 body
            while (tempDiv.firstChild) {
                document.body.appendChild(tempDiv.firstChild);
            }
        } catch (error) {
            console.error('載入設定面板模板失敗:', error);
        }
    }

    /**
     * 初始化 DOM 元素引用
     */
    initElements() {
        this.settingPanel = document.getElementById('setting-panel');
        this.settingOverlay = document.getElementById('setting-overlay');
        this.settingContent = document.getElementById('setting-content');
        this.settingContentInner = document.getElementById('setting-content-inner');
        this.scrollbarThumb = document.getElementById('scrollbar-thumb');
    }

    /**
     * 綁定事件監聽器
     */
    bindEvents() {
        // 關閉按鈕
        const closeBtn = document.getElementById('close-setting');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.close();
            });
        }

        // 遮罩點擊關閉
        if (this.settingOverlay) {
            this.settingOverlay.addEventListener('click', () => {
                this.close();
            });
        }

        // 滾動事件
        this.bindScrollEvents();

        // 設定項目點擊事件
        this.bindSettingItems();
    }

    /**
     * 綁定滾動相關事件
     */
    bindScrollEvents() {
        if (!this.settingContent) return;

        // 鼠標拖動
        this.settingContent.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startY = e.clientY;
            this.scrollTop = parseFloat(this.settingContentInner.style.top || 0);
            this.settingContent.classList.add('dragging');
            e.preventDefault();
        });

        // 觸控拖動
        this.settingContent.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.startY = e.touches[0].clientY;
            this.scrollTop = parseFloat(this.settingContentInner.style.top || 0);
            this.settingContent.classList.add('dragging');
        }, { passive: true });

        // 鼠標移動
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaY = e.clientY - this.startY;
            const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop + deltaY));
            this.settingContentInner.style.top = newScrollTop + 'px';
            this.scrollTop = newScrollTop;
            this.updateScrollbar();
        });

        // 觸控移動
        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const deltaY = e.touches[0].clientY - this.startY;
            const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop + deltaY));
            this.settingContentInner.style.top = newScrollTop + 'px';
            this.scrollTop = newScrollTop;
            this.updateScrollbar();
        }, { passive: true });

        // 結束拖動
        const endDrag = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.settingContent.classList.remove('dragging');
            }
        };

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);

        // 滾輪事件
        this.settingContent.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop - delta));
            this.settingContentInner.style.top = newScrollTop + 'px';
            this.scrollTop = newScrollTop;
            this.updateScrollbar();
        }, { passive: false });
    }

    /**
     * 綁定設定項目點擊事件
     */
    bindSettingItems() {
        document.querySelectorAll('.setting-item').forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onSettingItemClick(index + 1, item);
            });
        });
    }

    /**
     * 設定項目點擊回調（可被覆寫）
     */
    onSettingItemClick(index, element) {
        console.log('設定項目:', index);
    }

    /**
     * 初始化滾動條
     */
    initScrollbar() {
        if (!this.settingContent || !this.settingContentInner) return;

        // 使用 ResizeObserver 監聽尺寸變化
        const observer = new ResizeObserver(() => {
            this.updateScrollbar();
        });

        observer.observe(this.settingContent);
        observer.observe(this.settingContentInner);

        // 初始更新
        this.updateScrollbar();
    }

    /**
     * 更新滾動條位置和大小
     */
    updateScrollbar() {
        if (!this.scrollbarThumb || !this.settingContent || !this.settingContentInner) return;

        this.contentHeight = this.settingContentInner.scrollHeight;
        this.containerHeight = this.settingContent.clientHeight;
        this.maxScroll = Math.max(0, this.contentHeight - this.containerHeight);

        if (this.maxScroll > 0) {
            const thumbHeight = Math.max(30, (this.containerHeight / this.contentHeight) * this.containerHeight);
            const thumbTop = (Math.abs(this.scrollTop) / this.maxScroll) * (this.containerHeight - thumbHeight);
            this.scrollbarThumb.style.height = thumbHeight + 'px';
            this.scrollbarThumb.style.top = thumbTop + 'px';
        }
    }

    /**
     * 打開設定面板
     */
    open() {
        if (this.settingOverlay && this.settingPanel) {
            this.settingOverlay.classList.add('active');
            this.settingPanel.classList.add('active');
        }
    }

    /**
     * 關閉設定面板
     */
    close() {
        if (this.settingOverlay && this.settingPanel) {
            this.settingOverlay.classList.remove('active');
            this.settingPanel.classList.remove('active');
        }
    }

    /**
     * 切換設定面板開關狀態
     */
    toggle() {
        if (this.settingPanel && this.settingPanel.classList.contains('active')) {
            this.close();
        } else {
            this.open();
        }
    }
}
