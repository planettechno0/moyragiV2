import { state } from '../../core/state.js';
import { Utils } from '../shared/Utils.js';
import { db } from '../../services/db.js';
import { Toast } from '../shared/Toast.js';

export const VisitList = {
    render() {
        const tbody = document.getElementById('visitsTableBody');
        const noMsg = document.getElementById('noVisitsMsg');

        if (state.data.visits.length === 0) {
            tbody.innerHTML = '';
            noMsg.classList.remove('d-none');
            return;
        }
        noMsg.classList.add('d-none');

        tbody.innerHTML = '';
        state.data.visits.forEach(visit => {
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
    },

    async handleAction(action, id) {
        if (action === 'delete-visit') {
            if (confirm('قرار ویزیت حذف شود؟')) {
                await db.deleteVisit(id);
                // Refresh visits
                state.data.visits = await db.getVisits() || [];
                this.render();
            }
        }
        else if (action === 'complete-visit') {
            await db.updateVisitStatus(id, 'done');
            state.data.visits = await db.getVisits() || [];
            this.render();
        }
    }
};
