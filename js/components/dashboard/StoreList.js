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

        // Gather Filters
        const filters = {
            region: document.getElementById('filterRegion').value,
            purchaseProb: document.getElementById('filterProb').value,
            visitStatus: document.getElementById('filterVisitStatus').value,
            day: document.getElementById('filterDay').value
        };

        // Search Query is handled by SearchBar separate logic usually,
        // but if we want mixed filtering + search, we need a unified approach.
        // Currently `SearchBar.handleSearch` calls `db.searchStores` which is text-only.
        // To combine, `db.getStores` needs a search param or `db.searchStores` needs filters.
        // For now, let's assume Filters apply to the main list, and Search is a separate mode.
        // If Search is active (input not empty), we might ignore filters or we need to update `db.searchStores`.
        // The user requirement was "Client-side Filtering on Partial Data" -> "Server-side".
        // Let's stick to `getStores` using filters. `handleSearch` uses `db.searchStores`.
        // If search input has text, we should probably use `searchStores`?
        // But `searchStores` in `db.js` doesn't support other filters yet.
        // For simplicity and scope, I will implement filtering for the main list (no text search).
        // Text search remains separate mode.

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

            this.render(append ? newStores : null); // Pass only new stores if appending, or null to render all

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

        // Remove initial spinner if it exists
        const initialSpinner = container.querySelector('.spinner-border');
        if (initialSpinner && initialSpinner.parentElement && initialSpinner.parentElement.classList.contains('text-center')) {
             container.innerHTML = '';
        }

        if (!newStoresOnly) {
            container.innerHTML = ''; // Clear if full render
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
        if (!input.classList.contains('form-check-input') || input.dataset.action !== 'toggle-visit') return;

        const id = input.dataset.storeId;
        const visited = input.checked;

        const store = state.data.stores.find(s => s.id == id);
        if (store) {
             store.visited = visited;
             store.last_visit = visited ? new Date().toISOString() : null;
        }

        try {
            if (visited) {
                await db.logVisit(id);
            } else {
                await db.clearVisit(id);
            }
        } catch (error) {
            console.error(error);
            Toast.show('خطا در ثبت وضعیت', 'error');
            input.checked = !visited;
            if (store) {
                 store.visited = !visited;
                 store.last_visit = !visited ? new Date().toISOString() : null;
            }
        }
    }
};
