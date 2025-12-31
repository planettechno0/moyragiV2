import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { StoreList } from './StoreList.js';
import { Toast } from '../shared/Toast.js';

export const SearchBar = {
    async handleSearch() {
        const query = document.getElementById('searchInput').value.trim();
        const statusEl = document.getElementById('searchStatus');

        if (!query) {
            this.handleClearSearch();
            return;
        }

        const container = document.getElementById('storesContainer');
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">در حال جستجو...</div></div>';
        statusEl.textContent = 'در حال جستجو در دیتابیس...';
        statusEl.classList.remove('d-none');
        document.getElementById('loadMoreContainer').classList.add('d-none');

        try {
            const results = await db.searchStores(query);
            state.data.stores = results;
            state.pagination.hasMore = false;

            StoreList.render();

            if (results.length === 0) {
                statusEl.textContent = 'موردی یافت نشد.';
            } else {
                statusEl.textContent = `${results.length} مورد یافت شد.`;
            }
        } catch (error) {
            console.error(error);
            Toast.show('خطا در جستجو', 'error');
            statusEl.textContent = 'خطا در جستجو.';
            container.innerHTML = '';
        }
    },

    async handleClearSearch() {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchStatus').classList.add('d-none');
        state.resetPagination();
        await StoreList.loadChunk();
    },

    initListeners() {
        const filterHandler = () => StoreList.render();

        document.getElementById('searchInput').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.handleSearch();
            if (e.target.value === '') this.handleClearSearch();
        });
        document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch());

        document.getElementById('filterDay').addEventListener('change', filterHandler);
        document.getElementById('filterRegion').addEventListener('change', filterHandler);
        document.getElementById('filterProb').addEventListener('change', filterHandler);
        document.getElementById('filterVisitStatus').addEventListener('change', filterHandler);
    }
};
