import { state } from '../../core/state.js';
import { db } from '../../services/db.js';
import { Utils } from '../shared/Utils.js';

export const Statistics = {
    async render() {
        const totalEl = document.getElementById('statTotalStores');
        const tbody = document.getElementById('statsTableBody');

        totalEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        tbody.innerHTML = '<tr><td colspan="3" class="text-center"><span class="spinner-border spinner-border-sm"></span> در حال محاسبه...</td></tr>';

        try {
            let stores = state.data.stores;
            if (state.pagination.hasMore) {
                // If not all loaded, try fetching all for stats (heavy operation warning)
                stores = await db.getAllStores();
            }

            const total = stores.length;
            const regionCounts = {};

            stores.forEach(s => {
                const r = s.region || 'نامشخص';
                regionCounts[r] = (regionCounts[r] || 0) + 1;
            });

            // Render Total
            totalEl.textContent = total.toLocaleString('fa-IR');

            // Render Table
            tbody.innerHTML = '';
            const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);

            sortedRegions.forEach(([region, count]) => {
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.escapeHtml(region)}</td>
                    <td class="text-center fw-bold">${count.toLocaleString('fa-IR')}</td>
                    <td class="text-center">
                        <div class="d-flex align-items-center justify-content-center">
                            <span class="small me-2">%${percent.toLocaleString('fa-IR')}</span>
                            <div class="progress flex-grow-1" style="height: 6px; max-width: 100px;">
                                <div class="progress-bar" role="progressbar" style="width: ${percent}%"></div>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (e) {
            console.error(e);
            totalEl.textContent = 'خطا';
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">خطا در دریافت اطلاعات</td></tr>';
        }
    },

    initListeners() {
         document.getElementById('tab-stats-btn').addEventListener('shown.bs.tab', () => {
            this.render();
        });
        document.getElementById('refreshStatsBtn').addEventListener('click', () => {
            this.render();
        });
    }
};
