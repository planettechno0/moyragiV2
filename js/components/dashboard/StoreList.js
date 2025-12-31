import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { Toast } from '../shared/Toast.js';
import { StoreCard } from './StoreCard.js';

export const StoreList = {
    async loadChunk() {
        const loadingSpinner = state.pagination.page === 0
             ? document.querySelector('#storesContainer .spinner-border') // Initial load
             : document.getElementById('loadMoreLoading'); // Load more

        if (loadingSpinner && loadingSpinner.parentNode) loadingSpinner.parentNode.classList.remove('d-none');
        if (loadingSpinner && state.pagination.page > 0) loadingSpinner.classList.remove('d-none');

        try {
            const newStores = await db.getStores(state.pagination.page, state.pagination.pageSize);

            if (newStores.length < state.pagination.pageSize) {
                state.pagination.hasMore = false;
            }

            state.data.stores = [...state.data.stores, ...newStores];
            this.render(); // Append new stores
            state.pagination.page++;
        } catch (error) {
            console.error(error);
            Toast.show('خطا در دریافت لیست فروشگاه‌ها', 'error');
        } finally {
             if (loadingSpinner && state.pagination.page > 0) loadingSpinner.classList.add('d-none');
        }
    },

    render() {
        const container = document.getElementById('storesContainer');
        const emptyState = document.getElementById('emptyState');
        const loadMoreContainer = document.getElementById('loadMoreContainer');

        // Remove initial spinner if it exists
        const initialSpinner = container.querySelector('.spinner-border');
        if (initialSpinner && initialSpinner.parentElement && initialSpinner.parentElement.classList.contains('text-center')) {
             container.innerHTML = '';
        }

        // Clear container to support re-rendering with client-side filters
        container.innerHTML = '';

        const dayFilter = document.getElementById('filterDay').value;
        const regionFilter = document.getElementById('filterRegion').value;
        const probFilter = document.getElementById('filterProb').value;
        const visitStatusFilter = document.getElementById('filterVisitStatus').value;
        const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
        const currentDayIndex = new Date().getDay();
        const now = new Date();

        const filteredStores = state.data.stores.filter(store => {
            if (searchQuery) {
                const searchMatch = store.name.toLowerCase().includes(searchQuery) ||
                                    (store.address && store.address.toLowerCase().includes(searchQuery));
                if (!searchMatch) return false;
            }
            if (regionFilter !== 'all' && store.region !== regionFilter) return false;
            if (probFilter !== 'all' && store.purchase_prob !== probFilter) return false;

            if (visitStatusFilter !== 'all') {
                let isVisited7Days = false;
                if (store.last_visit) {
                    const lastVisitDate = new Date(store.last_visit);
                    const diffTime = Math.abs(now - lastVisitDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) isVisited7Days = true;
                }
                if (visitStatusFilter === 'visited' && !isVisited7Days) return false;
                if (visitStatusFilter === 'not_visited' && isVisited7Days) return false;
            }

            if (dayFilter === 'all') return true;
            if (dayFilter === 'today') {
                return store.visit_days && store.visit_days.includes(currentDayIndex);
            }
            return store.visit_days && store.visit_days.includes(parseInt(dayFilter));
        });

        if (filteredStores.length === 0) {
            if (state.data.stores.length === 0) emptyState.classList.remove('d-none');
        } else {
            emptyState.classList.add('d-none');
        }

        if (state.pagination.hasMore) {
            loadMoreContainer.classList.remove('d-none');
        } else {
            loadMoreContainer.classList.add('d-none');
        }

        const fragment = document.createDocumentFragment();

        filteredStores.forEach(store => {
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
