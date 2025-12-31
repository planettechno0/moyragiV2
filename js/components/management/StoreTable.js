import { state } from '../../core/state.js';
import { Utils } from '../shared/Utils.js';

export const StoreTable = {
    render() {
        const tbody = document.getElementById('storesTableBody');
        tbody.innerHTML = '';

        // Get Filter/Search values
        const search = document.getElementById('manageSearch').value.toLowerCase().trim();
        const region = document.getElementById('manageFilterRegion').value;
        const sort = document.getElementById('manageSort').value;
        const size = document.getElementById('managePageSize').value;

        // Filter and Sort
        let list = state.data.stores.filter(s => {
            if (region !== 'all' && s.region !== region) return false;
            if (search) {
                const match = s.name.toLowerCase().includes(search) ||
                              (s.phone && s.phone.includes(search)) ||
                              (s.seller_name && s.seller_name.toLowerCase().includes(search));
                if (!match) return false;
            }
            return true;
        });

        if (sort === 'name') {
            list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
        } else if (sort === 'newest') {
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sort === 'oldest') {
            list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        // Limit
        if (size !== 'all') {
            list = list.slice(0, parseInt(size));
        }

        // Render
        list.forEach(store => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Utils.escapeHtml(store.name)}</td>
                <td>${Utils.escapeHtml(store.region)}</td>
                <td>${Utils.escapeHtml(store.seller_name || '-')}</td>
                <td>${Utils.escapeHtml(store.phone || '-')}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-store" data-store-id="${store.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-store" data-store-id="${store.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    initListeners() {
        const refreshManagement = () => this.render();
        document.getElementById('manageSearch').addEventListener('input', refreshManagement);
        document.getElementById('manageFilterRegion').addEventListener('change', refreshManagement);
        document.getElementById('manageSort').addEventListener('change', refreshManagement);
        document.getElementById('managePageSize').addEventListener('change', refreshManagement);
    }
};
