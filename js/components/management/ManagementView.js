import { StoreTable } from './StoreTable.js';
import { Statistics } from './Statistics.js';
import { VisitList } from '../visits/VisitList.js';
import { state } from '../../core/state.js';
import { db } from '../../services/db.js';
import { StoreList } from '../dashboard/StoreList.js';
import { Toast } from '../shared/Toast.js';

export const ManagementView = {
    init() {
        StoreTable.initListeners();
        Statistics.initListeners();

        document.getElementById('manageLoadMoreBtn').addEventListener('click', async () => {
             await StoreList.loadChunk();
             if (!document.getElementById('managementView').classList.contains('d-none')) {
                 StoreTable.render();
             }
             Toast.show('اطلاعات بیشتر بارگزاری شد', 'info');
        });

        document.getElementById('manageLoadAllBtn').addEventListener('click', async () => {
             if (confirm('آیا از بارگزاری تمام اطلاعات اطمینان دارید؟ این عملیات ممکن است کمی زمان ببرد.')) {
                 try {
                     const allStores = await db.getAllStores();
                     const existingIds = new Set(state.data.stores.map(s => s.id));
                     const newStores = allStores.filter(s => !existingIds.has(s.id));
                     state.data.stores = [...state.data.stores, ...newStores];

                     state.pagination.hasMore = false;
                     StoreTable.render();
                     Toast.show('تمام اطلاعات بارگزاری شد.', 'success');
                 } catch (e) {
                     console.error(e);
                     Toast.show('خطا در دریافت اطلاعات', 'error');
                 }
             }
        });
    },

    show() {
        document.getElementById('managementView').classList.remove('d-none');
        StoreTable.render();
        VisitList.render(); // Also shows visits in management view
    },

    hide() {
        document.getElementById('managementView').classList.add('d-none');
    }
};
