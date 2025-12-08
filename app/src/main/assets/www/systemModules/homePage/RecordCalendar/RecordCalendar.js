/**
 * Record Calendar Component
 * 記帳日曆組件 - 負責渲染首頁主要內容區域
 */
export default class RecordCalendar {
    constructor() {
        this.Agent = null;
        this.container = null;
        this.eventPlatform = null;
        // 模擬後端數據 [年, 月, 日, 支出, 收入]
        this.jsonData = [
            [2025, 11, 28, 150, 0],  // 支出
            [2025, 11, 28, 0, 200],  // 收入
            [2025, 11, 28, 75, 0],   // 支出
            [2025, 11, 29, 300, 0],  // 支出
            [2025, 11, 29, 0, 120],  // 收入
            [2025, 11, 30, 450, 0],  // 支出
            [2025, 11, 30, 0, 80],   // 收入
            [2025, 11, 30, 220, 0],  // 支出
            [2025, 12, 1, 0, 350],   // 收入
            [2025, 12, 1, 180, 0],   // 支出
            [2025, 12, 1, 0, 90],    // 收入
            [2025, 12, 2, 400, 0],   // 支出
            [2025, 12, 2, 0, 250],   // 收入
            [2025, 12, 2, 50, 0]     // 支出
        ];
        this.selectedDate = null;
        this.eventListeners = [];
        this.currentView = 'calendar'; // 'calendar' or 'list'

    }
    init(Agent) {
        this.Agent = Agent;
        this.logger = Agent.tools.logger;
        this.eventPlatform = Agent.eventPlatform;
        this.container = Agent.myDOM.querySelector(".home-calendar-view");
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth() + 1; // 1-12
        if (!this.container) {
            this.logger.error('RecordCalendar container not found!');
            return false;
        }
        this.setEvents();
        this.render();
        this.logger.debug(`RecordCalendar initialized`);
        return true;
    }
    setEvents() {
        this.eventPlatform.on("doCalendar_calendar", () => this.switchView('calendar'));
        this.eventPlatform.on("doCalendar_list", () => this.switchView('list'));
    }

    render() {
        // 初始化日曆
        this.initCalendar();

        // 根據當前視圖顯示內容
        this.switchView(this.currentView);
        this.logger.debug(`RecordCalendar rendered`);
    }

    /**
     * 初始化日曆
     */
    initCalendar() {
        // 綁定月份切換按鈕
        this.bindMonthNavigation();

        // 渲染當前月份
        this.renderCalendar();
    }

    /**
     * 綁定月份切換按鈕
     */
    bindMonthNavigation() {
        const prevBtn = this.container.querySelector('#prev-month-btn');
        const nextBtn = this.container.querySelector('#next-month-btn');

        if (prevBtn) {
            const prevHandler = (e) => {
                e.preventDefault();
                this.changeMonth(-1);
            };
            prevBtn.addEventListener('click', prevHandler);
            this.eventListeners.push({ element: prevBtn, event: 'click', handler: prevHandler });
        }

        if (nextBtn) {
            const nextHandler = (e) => {
                e.preventDefault();
                this.changeMonth(1);
            };
            nextBtn.addEventListener('click', nextHandler);
            this.eventListeners.push({ element: nextBtn, event: 'click', handler: nextHandler });
        }
    }

    /**
     * 切換月份
     * @param {number} delta - 月份變化量（-1 或 1）
     */
    changeMonth(delta) {
        this.currentMonth += delta;

        if (this.currentMonth > 12) {
            this.currentMonth = 1;
            this.currentYear++;
        } else if (this.currentMonth < 1) {
            this.currentMonth = 12;
            this.currentYear--;
        }

        // 更新月份標題
        this.updateMonthTitle();

        // 根據當前視圖渲染內容
        if (this.currentView === 'calendar') {
            this.renderCalendar();
        } else if (this.currentView === 'list') {
            this.renderMonthList();
        }
    }

    /**
     * 更新月份標題
     */
    updateMonthTitle() {
        const monthTitle = this.container.querySelector('#current-month');
        if (monthTitle) {
            monthTitle.textContent = `${this.currentYear}年${this.currentMonth}月`;
        }
    }

    /**
     * 渲染日曆
     */
    renderCalendar() {
        // 獲取日曆網格
        const grid = this.container.querySelector('#calendar-grid');
        if (!grid) return;

        // 清空舊的日期格子
        grid.innerHTML = '';

        // 計算當月第一天是星期幾（0=日, 1=一, ...）
        const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();

        // 計算當月有多少天
        const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

        // 添加空白格子（月初前的空白）
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            grid.appendChild(emptyCell);
        }

        // 添加日期格子
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = day;
            dayCell.dataset.date = `${this.currentYear}-${this.currentMonth}-${day}`;

            // 檢查是否有記錄
            const hasRecord = this.hasRecordOnDate(this.currentYear, this.currentMonth, day);
            if (hasRecord) {
                dayCell.classList.add('has-record');
            }

            // 標記今天
            const today = new Date();
            if (this.currentYear === today.getFullYear() &&
                this.currentMonth === today.getMonth() + 1 &&
                day === today.getDate()) {
                dayCell.classList.add('today');
            }

            // 綁定點擊事件
            const clickHandler = () => this.selectDate(this.currentYear, this.currentMonth, day);
            dayCell.addEventListener('click', clickHandler);
            this.eventListeners.push({ element: dayCell, event: 'click', handler: clickHandler });

            grid.appendChild(dayCell);
        }
    }

    /**
     * 檢查指定日期是否有記錄
     */
    hasRecordOnDate(year, month, day) {
        return this.jsonData.some(record =>
            record[0] === year && record[1] === month && record[2] === day
        );
    }

    /**
     * 選擇日期並顯示記錄
     */
    selectDate(year, month, day) {
        this.selectedDate = { year, month, day };

        // 更新選中狀態
        this.container.querySelectorAll('.calendar-day').forEach(cell => {
            cell.classList.remove('selected');
        });

        const selectedCell = this.container.querySelector(`[data-date="${year}-${month}-${day}"]`);
        if (selectedCell) {
            selectedCell.classList.add('selected');
        }

        // 顯示記錄
        this.displayRecords(year, month, day);
    }

    /**
     * 顯示指定日期的記錄
     */
    displayRecords(year, month, day) {
        const dateHeader = this.container.querySelector('#selected-date');
        const recordsList = this.container.querySelector('#records-list');

        if (!dateHeader || !recordsList) return;

        // 更新日期標題
        dateHeader.textContent = `${year}年${month}月${day}日`;

        // 查找該日期的記錄
        const records = this.jsonData.filter(record =>
            record[0] === year && record[1] === month && record[2] === day
        );

        if (records.length === 0) {
            recordsList.innerHTML = '<p class="no-records">此日期無記錄</p>';
            return;
        }

        // 渲染記錄列表
        let html = '<div class="record-items">';
        records.forEach(record => {
            const [y, m, d, expense, income] = record;
            html += `
                <div class="record-item">
                    <div class="record-info">
                        <span class="record-type ${expense > 0 ? 'expense' : 'income'}">
                            ${expense > 0 ? '支出' : '收入'}
                        </span>
                        <span class="record-amount ${expense > 0 ? 'expense' : 'income'}">
                            ${expense > 0 ? '-' : '+'}${expense > 0 ? expense : income}
                        </span>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        recordsList.innerHTML = html;
    }

    /**
     * 渲染月份清單視圖
     */
    renderMonthList() {
        const dateHeader = this.container.querySelector('#selected-date');
        const recordsList = this.container.querySelector('#records-list');

        if (!dateHeader || !recordsList) return;

        // 更新標題
        dateHeader.textContent = `${this.currentYear}年${this.currentMonth}月記錄`;

        // 篩選當月的記錄
        const monthRecords = this.jsonData.filter(record =>
            record[0] === this.currentYear && record[1] === this.currentMonth
        );

        if (monthRecords.length === 0) {
            recordsList.innerHTML = '<p class="no-records">本月無記錄</p>';
            return;
        }

        // 渲染記錄列表
        let html = '<div class="record-items">';
        monthRecords.forEach(record => {
            const [year, month, day, expense, income] = record;
            html += `
                <div class="record-item">
                    <div class="record-date">${month}月${day}日</div>
                    <div class="record-info">
                        <span class="record-type ${expense > 0 ? 'expense' : 'income'}">
                            ${expense > 0 ? '支出' : '收入'}
                        </span>
                        <span class="record-amount ${expense > 0 ? 'expense' : 'income'}">
                            ${expense > 0 ? '-' : '+'}${expense > 0 ? expense : income}
                        </span>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        recordsList.innerHTML = html;
    }

    /**
     * 切換視圖模式
     * @param {string} view - 'calendar' 或 'list'
     */
    switchView(view) {
        this.currentView = view;

        const monthSelector = this.container.querySelector('.month-selector');
        const calendarContainer = this.container.querySelector('.calendar-container');
        const recordsContainer = this.container.querySelector('.records-container');
        const divider = this.container.querySelector('.calendar-divider');

        if (view === 'calendar') {
            // 顯示日曆視圖（上下分割）
            if (monthSelector) monthSelector.style.display = 'flex';
            if (calendarContainer) calendarContainer.style.display = 'flex';
            if (recordsContainer) {
                recordsContainer.style.display = 'flex';
                recordsContainer.classList = 'records-container calendar';
            }
            if (divider) divider.style.display = 'block';

            // 渲染日曆
            this.renderCalendar();
        } else if (view === 'list') {
            // 顯示清單視圖
            if (monthSelector) monthSelector.style.display = 'flex';
            if (calendarContainer) calendarContainer.style.display = 'none';
            if (divider) divider.style.display = 'none';
            if (recordsContainer) {
                recordsContainer.classList = 'records-container list';
                recordsContainer.style.display = 'flex';
            }

            // 渲染月份清單
            this.renderMonthList();
        }
    }

    /**
     * 銷毀組件
     */
    destroy() {
        // 清理事件監聽器
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.eventListeners = [];

        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
        }
        console.log('✓ RecordCalendar destroyed');
    }
}
