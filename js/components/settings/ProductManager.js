import { state } from '../../core/state.js';
import { db } from '../../services/db.js';
import { Toast } from '../shared/Toast.js';
import { Utils } from '../shared/Utils.js';

export const ProductManager = {
    async add() {
        const name = document.getElementById('newProductInput').value.trim();
        if (!name) return;
        try {
            await db.addProduct(name);
            document.getElementById('newProductInput').value = '';

            const products = await db.getProducts();
            state.data.products = products || [];
            this.render();

            Toast.show('کالا افزوده شد.', 'success');
        } catch(e) { console.error(e); Toast.show('خطا در افزودن کالا', 'error'); }
    },

    async delete(id) {
        if (confirm('حذف شود؟')) {
            await db.deleteProduct(id);
            const products = await db.getProducts();
            state.data.products = products || [];
            this.render();
        }
    },

    render() {
        const list = document.getElementById('productList');
        const select = document.getElementById('orderProductSelect'); // This is in Order Modal, but updated here
        list.innerHTML = '';
        // Note: We don't want to wipe orderProductSelect if modal is open/active, but usually it's fine.
        select.innerHTML = '<option value="">انتخاب کالا...</option>';

        state.data.products.forEach(product => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                ${Utils.escapeHtml(product.name)}
                <button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${product.id}">
                    <i class="bi bi-trash"></i>
                </button>
            `;
            list.appendChild(li);

            const opt = document.createElement('option');
            opt.value = product.id;
            opt.textContent = product.name;
            opt.dataset.name = product.name;
            select.appendChild(opt);
        });
    }
};
