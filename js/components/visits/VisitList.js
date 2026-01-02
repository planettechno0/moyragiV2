import { state } from '../../core/state.js';
import { Utils } from '../shared/Utils.js';
import { db } from '../../services/db.js';
import { Toast } from '../shared/Toast.js';

export const VisitList = {
    // Modified to be async and fetch directly from DB to ensure data consistency
    async render() {
        const tbody = document.getElementById('visitsTableBody');
        const noMsg = document.getElementById('noVisitsMsg');

        try {
            // Fetch fresh data directly from DB
            const visits = await db.getVisits() || [];

            // Sync global state for other consumers (notifications etc)
            state.data.visits = visits;

            if (visits.length === 0) {
                tbody.innerHTML = '';
                noMsg.classList.remove('d-none');
                return;
            }
            noMsg.classList.add('d-none');

            tbody.innerHTML = '';

            // Sort client-side just in case, though DB sort is preferred
            // visits.sort((a,b) => ...); // DB already sorts by date

            visits.forEach(visit => {
                const statusBadge = visit.status === 'done'
                    ? '<span class="badge bg-success">انجام شده</span>'
                    : '<span class="badge bg-warning text-dark">در انتظار</span>';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.escapeHtml(visit.visit_date)}</td>
                    <td>${Utils.escapeHtml(visit.visit_time || '-')}</td>
                    <td>${Utils.escapeHtml(visit.store?.name || '-')}</td>
                    <td><small class="text-muted">${Utils.escapeHtml(visit.note || '-')}</small></td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        ${visit.status !== 'done' ? `
                        <button class="btn btn-sm btn-success me-1" data-action="complete-visit" data-id="${visit.id}" title="انجام شد">
                            <i class="bi bi-check-lg"></i>
                        </button>` : ''}
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-visit" data-id="${visit.id}" title="حذف">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error rendering visits:', error);
            Toast.show('خطا در دریافت لیست ویزیت‌ها', 'error');
        }
    },

    async handleAction(action, id) {
        try {
            if (action === 'delete-visit') {
                if (confirm('قرار ویزیت حذف شود؟')) {
                    await db.deleteVisit(id);
                    await this.render();
                    Toast.show('حذف شد', 'success');
                }
            }
            else if (action === 'complete-visit') {
                await db.updateVisitStatus(id, 'done');
                await this.render();
                Toast.show('وضعیت تغییر کرد', 'success');
            }
        } catch (err) {
            console.error(err);
            Toast.show('خطا در عملیات', 'error');
        }
    }
};
