/**
 * Home Page
 * 首頁邏輯 - 處理首頁特定的交互和事件
 */
export class HomePage {
    constructor(router, settingPanel) {
        this.router = router;
        this.settingPanel = settingPanel;
        this.init();
    }

    /**
     * 初始化首頁
     */
    init() {
        this.bindMenuButtons();
    }

    /**
     * 綁定菜單按鈕事件
     */
    bindMenuButtons() {
        // 設定按鈕
        const settingBtn = document.getElementById('setting-btn');
        if (settingBtn) {
            settingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.settingPanel.open();
            });
        }

        // 記一筆按鈕
        const newRecordBtn = document.getElementById('new-record-btn');
        if (newRecordBtn) {
            newRecordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.router.navigate('pages/new_record.html');
            });
        }

        // 其他按鈕
        document.querySelectorAll('.menu-btn').forEach(btn => {
            if (btn.id !== 'setting-btn' && btn.id !== 'new-record-btn') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('按鈕點擊:', btn.textContent);
                });
            }
        });
    }

    /**
     * 頁面清理
     */
    destroy() {
        // 移除事件監聽器等清理工作
        console.log('Home page destroyed');
    }
}
