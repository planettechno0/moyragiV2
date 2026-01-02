import { db } from '../../services/db.js';
import { UIManager } from '../../ui.js';

export const ProductManager = {
    products: [],

    async init() {
        await this.loadProducts();
        this.render();
    },

    async loadProducts() {
        try {
            this.products = await db.getProducts();
        } catch (error) {
            console.error('Failed to load products:', error);
            UIManager.showToast('خطا در بارگذاری محصولات', 'error');
        }
    },

    render() {
        const container = document.getElementById('product-list');
        if (!container) return;

        container.innerHTML = this.products.map(product => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${product.name}</span>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-product"
                            data-id="${product.id}"
                            data-name="${product.name}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-product"
                            data-id="${product.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Re-attach event listeners specifically for the product list
        this.attachListeners();
    },

    attachListeners() {
        const container = document.getElementById('product-list');
        if (!container) return;

        // Delete buttons
        container.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('button').dataset.id;
                if (confirm('آیا از حذف این محصول مطمئن هستید؟')) {
                    await this.deleteProduct(id);
                }
            });
        });

        // Edit buttons
        container.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                const id = button.dataset.id;
                const name = button.dataset.name;
                this.promptEdit(id, name);
            });
        });
    },

    async addProduct(name) {
        if (!name.trim()) return;

        try {
            await db.addProduct(name);
            await this.loadProducts();
            this.render();
            UIManager.showToast('محصول با موفقیت اضافه شد');
        } catch (error) {
            console.error('Error adding product:', error);
            UIManager.showToast('خطا در افزودن محصول', 'error');
        }
    },

    async deleteProduct(id) {
        try {
            await db.deleteProduct(id);
            await this.loadProducts();
            this.render();
            UIManager.showToast('محصول حذف شد');
        } catch (error) {
            console.error('Error deleting product:', error);
            UIManager.showToast('خطا در حذف محصول', 'error');
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
            await this.loadProducts();
            this.render();
            UIManager.showToast('محصول ویرایش شد');
        } catch (error) {
            console.error('Error editing product:', error);
            UIManager.showToast('خطا در ویرایش محصول', 'error');
        }
    }
};
