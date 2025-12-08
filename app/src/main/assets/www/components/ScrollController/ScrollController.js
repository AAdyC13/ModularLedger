/**
 * ScrollController Component
 * 通用滾動控制器 - 統一管理所有滾動交互（拖動、滾輪、滾動條）
 */
export class ScrollController {
    /**
     * @param {HTMLElement} container - 滾動容器（可視區域）
     * @param {HTMLElement} content - 滾動內容（實際內容）
     * @param {HTMLElement} [scrollbarThumb] - 滾動條滑塊（可選）
     */
    constructor(container, content, scrollbarThumb = null) {
        this.container = container;
        this.content = content;
        this.scrollbarThumb = scrollbarThumb;

        this.isDragging = false;
        this.startY = 0;
        this.scrollTop = 0;
        this.contentHeight = 0;
        this.containerHeight = 0;
        this.maxScroll = 0;
        this.resizeObserver = null;

        // 綁定方法以保持 this 引用
        this.boundHandlers = {
            mouseDown: this.handleMouseDown.bind(this),
            touchStart: this.handleTouchStart.bind(this),
            mouseMove: this.handleMouseMove.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            endDrag: this.handleEndDrag.bind(this),
            wheel: this.handleWheel.bind(this)
        };

        this.init();
    }

    /**
     * 初始化滾動控制器
     */
    init() {
        this.bindEvents();
        this.initScrollbar();
    }

    /**
     * 綁定所有滾動事件
     */
    bindEvents() {
        // 鼠標拖動開始
        this.container.addEventListener('mousedown', this.boundHandlers.mouseDown);

        // 觸控拖動開始
        this.container.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: true });

        // 鼠標移動
        document.addEventListener('mousemove', this.boundHandlers.mouseMove);

        // 觸控移動
        document.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: true });

        // 結束拖動
        document.addEventListener('mouseup', this.boundHandlers.endDrag);
        document.addEventListener('touchend', this.boundHandlers.endDrag);

        // 滾輪事件
        this.container.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
    }

    /**
     * 解除所有事件綁定
     */
    unbindEvents() {
        this.container.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        this.container.removeEventListener('touchstart', this.boundHandlers.touchStart);
        document.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        document.removeEventListener('touchmove', this.boundHandlers.touchMove);
        document.removeEventListener('mouseup', this.boundHandlers.endDrag);
        document.removeEventListener('touchend', this.boundHandlers.endDrag);
        this.container.removeEventListener('wheel', this.boundHandlers.wheel);
    }

    /**
     * 鼠標按下處理
     */
    handleMouseDown(e) {
        // 如果點擊的是輸入框，不啟動拖動
        if (e.target.closest('.form-input')) return;

        this.isDragging = true;
        this.startY = e.clientY;
        this.scrollTop = parseFloat(this.content.style.top || 0);
        this.container.classList.add('dragging');
        e.preventDefault();
    }

    /**
     * 觸控開始處理
     */
    handleTouchStart(e) {
        // 如果點擊的是輸入框，不啟動拖動
        if (e.target.closest('.form-input')) return;

        this.isDragging = true;
        this.startY = e.touches[0].clientY;
        this.scrollTop = parseFloat(this.content.style.top || 0);
        this.container.classList.add('dragging');
    }

    /**
     * 鼠標移動處理
     */
    handleMouseMove(e) {
        if (!this.isDragging) return;

        const deltaY = e.clientY - this.startY;
        const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop + deltaY));
        this.content.style.top = newScrollTop + 'px';
        this.scrollTop = newScrollTop;
        this.updateScrollbar();
    }

    /**
     * 觸控移動處理
     */
    handleTouchMove(e) {
        if (!this.isDragging) return;

        const deltaY = e.touches[0].clientY - this.startY;
        const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop + deltaY));
        this.content.style.top = newScrollTop + 'px';
        this.scrollTop = newScrollTop;
        this.updateScrollbar();
    }

    /**
     * 結束拖動處理
     */
    handleEndDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.container.classList.remove('dragging');
        }
    }

    /**
     * 滾輪處理
     */
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY;
        const newScrollTop = Math.max(-this.maxScroll, Math.min(0, this.scrollTop - delta));
        this.content.style.top = newScrollTop + 'px';
        this.scrollTop = newScrollTop;
        this.updateScrollbar();
    }

    /**
     * 初始化滾動條
     */
    initScrollbar() {
        if (!this.scrollbarThumb) return;

        // 使用 ResizeObserver 監聽尺寸變化
        this.resizeObserver = new ResizeObserver(() => {
            this.updateScrollbar();
        });

        this.resizeObserver.observe(this.container);
        this.resizeObserver.observe(this.content);

        // 初始更新
        this.updateScrollbar();
    }

    /**
     * 更新滾動條位置和大小
     */
    updateScrollbar() {
        if (!this.scrollbarThumb) return;

        this.contentHeight = this.content.scrollHeight;
        this.containerHeight = this.container.clientHeight;
        this.maxScroll = Math.max(0, this.contentHeight - this.containerHeight);

        if (this.maxScroll > 0) {
            const thumbHeight = Math.max(30, (this.containerHeight / this.contentHeight) * this.containerHeight);
            const thumbTop = (Math.abs(this.scrollTop) / this.maxScroll) * (this.containerHeight - thumbHeight);
            this.scrollbarThumb.style.height = thumbHeight + 'px';
            this.scrollbarThumb.style.top = thumbTop + 'px';
        }
    }

    /**
     * 手動更新滾動條（外部調用）
     */
    refresh() {
        this.updateScrollbar();
    }

    /**
     * 銷毀滾動控制器
     */
    destroy() {
        // 解除事件綁定
        this.unbindEvents();

        // 清理 ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // 清理引用
        this.container = null;
        this.content = null;
        this.scrollbarThumb = null;
    }
}
