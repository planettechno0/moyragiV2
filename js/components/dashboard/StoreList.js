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

        // Helper to update local logs
        const updateLocalLogs = (newLog) => {
            if (!store) return;
            if (!store.visit_logs) store.visit_logs = [];

            // Check if log with same ID exists (update) or push new
            // Note: `logVisit` returns the full record.
            const existingIndex = store.visit_logs.findIndex(l => l.id === newLog.id);
            if (existingIndex >= 0) {
                store.visit_logs[existingIndex] = newLog;
            } else {
                // If it's a new log for today, we might have replaced an old one in DB logic?
                // DB logic: Update if found for today.
                // So the returned log has the ID of the existing one if updated.
                // But local state might have the old version.
                // If we found it by ID, we replaced it.
                // If ID is new, we push it.
                store.visit_logs.unshift(newLog); // Add to top
            }
            // Sort?
            store.visit_logs.sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at));
        };

        if (action === 'toggle-visit') {
            // Optimistic update
            if (store) {
                 store.visited = checked;
                 store.last_visit = checked ? new Date().toISOString() : null;
            }
            try {
                if (checked) {
                    const log = await db.logVisit(id, 'physical');
                    if (log) updateLocalLogs(log);
                } else {
                    await db.clearVisit(id);
                    // Also clear local log state?
                    // `clearVisit` in DB only updates store `last_visit`. It does NOT delete logs.
                    // So we keep the log? User just unchecked the "Visited" status.
                    // If they want to delete log, they do it in details.
                    // But `toggle-phone-visit` logic below explicitly deletes log.
                    // Consistency issue?
                    // User requirement: "Check box... saved".
                    // If unchecked, "visited" status is cleared. Log remains as history?
                    // `db.clearVisit` implementation: update stores set last_visit=null.
                    // It does NOT touch visit_logs.
                    // So we don't remove log locally.
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
            try {
                if (checked) {
                    const log = await db.logVisit(id, 'phone');
                    if (store) {
                        store.visited = true;
                        store.last_visit = new Date().toISOString();
                    }
                    if (log) updateLocalLogs(log);
                } else {
                    // Remove phone visit log for today
                    await db.clearVisitLogByType(id, 'phone');

                    // Remove from local state
                    if (store && store.visit_logs) {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        store.visit_logs = store.visit_logs.filter(l =>
                            !(l.visited_at.startsWith(todayStr) && l.visit_type === 'phone')
                        );
                    }
                }
            } catch (error) {
                console.error(error);
                Toast.show('خطا در ثبت ویزیت تلفنی', 'error');
                input.checked = !checked;
            }
        }
    }
};
