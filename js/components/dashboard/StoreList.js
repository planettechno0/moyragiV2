import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { Toast } from '../shared/Toast.js';
import { StoreCard } from './StoreCard.js';

export const StoreList = {
    async loadChunk(append = true) {
        const loadingSpinner = state.pagination.page === 0
             ? document.querySelector('#storesContainer .spinner-border')
             : document.getElementById('loadMoreLoading');

        if (loadingSpinner && loadingSpinner.parentNode) loadingSpinner.parentNode.classList.remove('d-none');
        if (loadingSpinner && state.pagination.page > 0) loadingSpinner.classList.remove('d-none');

        const filters = {
            region: document.getElementById('filterRegion').value,
            purchaseProb: document.getElementById('filterProb').value,
            visitStatus: document.getElementById('filterVisitStatus').value,
            day: document.getElementById('filterDay').value
        };

        try {
            const newStores = await db.getStores(state.pagination.page, state.pagination.pageSize, filters);

            if (newStores.length < state.pagination.pageSize) {
                state.pagination.hasMore = false;
            }

            if (append) {
                state.data.stores = [...state.data.stores, ...newStores];
            } else {
                state.data.stores = newStores;
            }

            this.render(append ? newStores : null);

            state.pagination.page++;
        } catch (error) {
            console.error(error);
            Toast.show('خطا در دریافت لیست فروشگاه‌ها', 'error');
        } finally {
             if (loadingSpinner && state.pagination.page > 0) loadingSpinner.classList.add('d-none');
        }
    },

    render(newStoresOnly = null) {
        const container = document.getElementById('storesContainer');
        const emptyState = document.getElementById('emptyState');
        const loadMoreContainer = document.getElementById('loadMoreContainer');

        const initialSpinner = container.querySelector('.spinner-border');
        if (initialSpinner && initialSpinner.parentElement && initialSpinner.parentElement.classList.contains('text-center')) {
             container.innerHTML = '';
        }

        if (!newStoresOnly) {
            container.innerHTML = '';
        }

        const storesToRender = newStoresOnly || state.data.stores;

        if (state.data.stores.length === 0) {
            emptyState.classList.remove('d-none');
        } else {
            emptyState.classList.add('d-none');
        }

        if (state.pagination.hasMore) {
            loadMoreContainer.classList.remove('d-none');
        } else {
            loadMoreContainer.classList.add('d-none');
        }

        const fragment = document.createDocumentFragment();
        const now = new Date();

        storesToRender.forEach(store => {
            let isVisited = false;
            if (store.last_visit) {
                const lastVisitDate = new Date(store.last_visit);
                const diffTime = Math.abs(now - lastVisitDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) {
                    isVisited = true;
                }
            } else if (store.visited) {
                 isVisited = true;
            }

            const card = StoreCard.create(store, isVisited);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    },

    // Toggle handling
    async handleStoreToggle(e) {
        const input = e.target;
        if (!input.classList.contains('form-check-input')) return;

        const action = input.dataset.action;
        const id = input.dataset.storeId;
        const checked = input.checked;
        const store = state.data.stores.find(s => s.id == id);

        if (action === 'toggle-visit') {
            // Optimistic update
            if (store) {
                 store.visited = checked;
                 store.last_visit = checked ? new Date().toISOString() : null;
            }
            try {
                if (checked) {
                    await db.logVisit(id, 'physical');
                } else {
                    await db.clearVisit(id);
                }
            } catch (error) {
                console.error(error);
                Toast.show('خطا در ثبت وضعیت', 'error');
                input.checked = !checked; // Revert
                if (store) {
                     store.visited = !checked;
                     store.last_visit = !checked ? new Date().toISOString() : null;
                }
            }
        }
        else if (action === 'toggle-phone-visit') {
            // Optimistic? Phone visit usually implies visited.
            // But we don't have a specific "phone_visited" field on store,
            // except we use 'last_visit' for general recency.
            // If checked, we log 'phone'.
            // If unchecked, we might need to delete the log?
            // "Toggle" implies on/off state for TODAY.
            // If we check it, we log a phone visit for today.
            // If we uncheck it, we should probably delete the phone visit log for today.

            try {
                if (checked) {
                    await db.logVisit(id, 'phone');
                    // Also update store visual state if we want phone visit to count as "Visited"
                    // User requirement: "Status... saved in details".
                    // But usually any contact counts as visit.
                    // Let's assume it counts for `last_visit`.
                    if (store) {
                        store.visited = true;
                        store.last_visit = new Date().toISOString();
                        // Also visually update the physical toggle if it wasn't checked?
                        // Maybe keep them independent but both update last_visit.
                    }
                } else {
                    // Remove phone visit log for today
                    await db.clearVisitLogByType(id, 'phone');
                    // We don't necessarily clear `last_visit` because physical visit might still be there.
                    // Complex logic: check if other logs exist today.
                    // For MVP, just remove the log.
                }
            } catch (error) {
                console.error(error);
                Toast.show('خطا در ثبت ویزیت تلفنی', 'error');
                input.checked = !checked;
            }
        }
    }
};
