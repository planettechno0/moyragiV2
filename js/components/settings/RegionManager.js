import { state } from '../../core/state.js';
import { db } from '../../db.js';
import { Toast } from '../shared/Toast.js';
import { Utils } from '../shared/Utils.js';

export const RegionManager = {
    async add() {
        const name = document.getElementById('newRegionInput').value.trim();
        if (!name) return;
        try {
            await db.addRegion(name);
            document.getElementById('newRegionInput').value = '';

            // Reload and render
            const [regions] = await Promise.all([db.getRegions()]);
            state.data.regions = regions || [];
            this.render();

            Toast.show('منطقه افزوده شد.', 'success');
        } catch(e) { console.error(e); Toast.show('خطا در افزودن منطقه', 'error'); }
    },

    async delete(id) {
        if (confirm('حذف شود؟')) {
            await db.deleteRegion(id);

             // Reload and render
            const [regions] = await Promise.all([db.getRegions()]);
            state.data.regions = regions || [];
            this.render();
        }
    },

    render() {
        const list = document.getElementById('regionList');
        const filterSelect = document.getElementById('filterRegion');
        const modalSelect = document.getElementById('storeRegion');
        const manageFilterSelect = document.getElementById('manageFilterRegion');

        list.innerHTML = '';
        const currentFilter = filterSelect.value;
        const currentManageFilter = manageFilterSelect ? manageFilterSelect.value : 'all';

        filterSelect.innerHTML = '<option value="all">همه مناطق</option>';
        if (manageFilterSelect) manageFilterSelect.innerHTML = '<option value="all">همه</option>';
        modalSelect.innerHTML = '';

        state.data.regions.forEach(region => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                ${Utils.escapeHtml(region.name)}
                <button class="btn btn-sm btn-outline-danger" data-action="delete-region" data-id="${region.id}">
                    <i class="bi bi-trash"></i>
                </button>
            `;
            list.appendChild(li);

            const opt1 = document.createElement('option');
            opt1.value = region.name;
            opt1.textContent = region.name;
            filterSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = region.name;
            opt2.textContent = region.name;
            modalSelect.appendChild(opt2);

            if (manageFilterSelect) {
                const opt3 = document.createElement('option');
                opt3.value = region.name;
                opt3.textContent = region.name;
                manageFilterSelect.appendChild(opt3);
            }
        });

        filterSelect.value = currentFilter;
        if (manageFilterSelect) manageFilterSelect.value = currentManageFilter;
    }
};
