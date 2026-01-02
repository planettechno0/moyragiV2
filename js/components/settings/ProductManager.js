import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { Toast } from '../shared/Toast.js';
import { Utils } from '../shared/Utils.js';

export const ProductManager = {
    render() {
        const container = document.getElementById('productList');
        if (!container) return;

        container.innerHTML = '';
        state.data.products.forEach(product => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>${Utils.escapeHtml(product.name)}</span>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" data-action="edit-product" data-id="${product.id}" data-name="${Utils.escapeHtml(product.name)}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" data-action="delete-product" data-id="${product.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(li);
        });
    },

    async add() {
        const input = document.getElementById('newProductInput');
        const name = input.value.trim();
        if (!name) return;

        try {
            const newProduct = await db.addProduct(name);
            if (newProduct) {
                // Ensure state is updated correctly
                // db.addProduct returns the single inserted object or null/error
                state.data.products.push(newProduct);
                this.render();
                input.value = '';
                Toast.show('محصول با موفقیت اضافه شد', 'success');
                document.dispatchEvent(new Event('data-change'));
            }
        } catch (error) {
            console.error('Error adding product:', error);
            Toast.show('خطا در افزودن محصول', 'error');
        }
    },

    async delete(id) {
        if (!confirm('آیا از حذف این محصول مطمئن هستید؟')) return;
        try {
            await db.deleteProduct(id);
            state.data.products = state.data.products.filter(p => p.id != id);
            this.render();
            Toast.show('محصول حذف شد', 'success');
            document.dispatchEvent(new Event('data-change'));
        } catch (error) {
            console.error('Error deleting product:', error);
            Toast.show('خطا در حذف محصول', 'error');
        }
    },

    promptEdit(id, currentName) {
        const newName = prompt('نام جدید محصول را وارد کنید:', currentName);
        if (newName && newName.trim() !== '' && newName !== currentName) {
            this.editProduct(id, newName.trim());
        }
    },

    async editProduct(id, newName) {
        try {
            await db.updateProduct(id, newName);
            // Update local state
            const product = state.data.products.find(p => p.id == id);
            if (product) {
                product.name = newName;
            }
            this.render();
            Toast.show('محصول ویرایش شد', 'success');
            document.dispatchEvent(new Event('data-change'));
        } catch (error) {
            console.error('Error editing product:', error);
            Toast.show('خطا در ویرایش محصول', 'error');
        }
    }
};
