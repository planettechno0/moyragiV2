import { StoreList } from './StoreList.js';
import { SearchBar } from './SearchBar.js';
import { state } from '../../core/state.js';
import { db } from '../../services/db.js';
import { Toast } from '../shared/Toast.js';

export const DashboardView = {
    async init() {
        // Load Stores (Page 0)
        state.resetPagination();
        await StoreList.loadChunk();

        // Setup Listeners
        SearchBar.initListeners();

        document.getElementById('loadMoreBtn').addEventListener('click', () => StoreList.loadChunk());
        document.getElementById('storesContainer').addEventListener('change', (e) => StoreList.handleStoreToggle(e));
        document.getElementById('resetDailyBtn').addEventListener('click', () => this.handleResetDaily());
    },

    async handleResetDaily() {
        if (confirm('شروع روز جدید؟ همه ویزیت‌ها ریست می‌شوند.')) {
            await db.resetDailyVisits();
            // To refresh, we can reload initial data or just reset pagination and reload
            // Ideally we re-fetch everything
            state.resetPagination();
            await StoreList.loadChunk();
            Toast.show('روز جدید شروع شد.', 'success');
        }
    },

    // Renders the view (showing the tab)
    show() {
        document.getElementById('dashboardView').classList.remove('d-none');
        document.getElementById('fabContainer').classList.remove('d-none');
        StoreList.render(); // Ensure correct rendering if coming back from other views
    },

    hide() {
        document.getElementById('dashboardView').classList.add('d-none');
        document.getElementById('fabContainer').classList.add('d-none');
    }
};
