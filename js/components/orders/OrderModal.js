import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { Utils } from '../shared/Utils.js';
import { Toast } from '../shared/Toast.js';
import { dateUtils } from '../../services/date_utils.js';

export const OrderModal = {
    currentOrderItems: [],

    open(storeId, orderId = null) {
        document.getElementById('orderStoreId').value = storeId;
        document.getElementById('orderId').value = orderId || '';
        document.getElementById('orderText').value = '';
        document.getElementById('orderCartonCount').value = 1;
        this.currentOrderItems = [];

        if (orderId) {
            const store = state.data.stores.find(s => s.id == storeId);
            const order = store?.orders.find(o => o.id == orderId);
            if (order) {
                document.getElementById('orderText').value = order.text || '';
                this.currentOrderItems = JSON.parse(JSON.stringify(order.items || []));
            }
        }

        // Populate products dropdown (in case it wasn't populated or updated)
        this.renderProductOptions();

        this.renderItems();
        new bootstrap.Modal(document.getElementById('orderModal')).show();
    },

    renderProductOptions() {
        const select = document.getElementById('orderProductSelect');
        // Preserve "Select product..." option if desired, or rebuild
        select.innerHTML = '<option value="">انتخاب کالا...</option>';
        state.data.products.forEach(product => {
            const opt = document.createElement('option');
            opt.value = product.id;
            opt.textContent = product.name;
            opt.dataset.name = product.name;
            select.appendChild(opt);
        });
    },

    addItem() {
        const select = document.getElementById('orderProductSelect');
        const productId = select.value;
        const productName = select.options[select.selectedIndex]?.text;
        const count = parseInt(document.getElementById('orderCartonCount').value);

        if (!productId) {
            Toast.show('کالا انتخاب کنید', 'error');
            return;
        }

        const existing = this.currentOrderItems.find(i => i.productId == productId);
        if (existing) {
            existing.count += count;
        } else {
            this.currentOrderItems.push({ productId, productName, count });
        }
        this.renderItems();
    },

    removeItem(idx) {
        this.currentOrderItems.splice(idx, 1);
        this.renderItems();
    },

    renderItems() {
        const list = document.getElementById('orderItemsList');
        const msg = document.getElementById('noItemsMsg');
        list.innerHTML = '';

        if (this.currentOrderItems.length === 0) {
            msg.classList.remove('d-none');
        } else {
            msg.classList.add('d-none');
            this.currentOrderItems.forEach((item, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.escapeHtml(item.productName)}</td>
                    <td>${item.count}</td>
                    <td class="text-end"><button class="btn btn-sm text-danger" data-idx="${idx}">&times;</button></td>
                `;
                tr.querySelector('button').onclick = (e) => this.removeItem(e.target.dataset.idx);
                list.appendChild(tr);
            });
        }
    },

    async save() {
        const storeId = document.getElementById('orderStoreId').value;
        const orderId = document.getElementById('orderId').value;
        const text = document.getElementById('orderText').value;

        if (this.currentOrderItems.length === 0 && !text) {
            Toast.show('حداقل یک کالا یا توضیح وارد کنید', 'error');
            return;
        }

        const orderData = {
            date: dateUtils.toJalaali(new Date()),
            text,
            items: this.currentOrderItems
        };

        try {
            let savedOrder = null;
            if (orderId) {
                savedOrder = await db.updateOrder(orderId, orderData);
            } else {
                savedOrder = await db.addOrder(storeId, orderData);
            }

            // Optimistic / Local Update
            if (savedOrder) {
                const store = state.data.stores.find(s => s.id == storeId);
                if (store) {
                    if (!store.orders) store.orders = [];

                    if (orderId) {
                        const idx = store.orders.findIndex(o => o.id == orderId);
                        if (idx >= 0) {
                            store.orders[idx] = savedOrder;
                        }
                    } else {
                        store.orders.unshift(savedOrder);
                    }
                    store.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }
            }

            bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();

            // Dispatch view-update instead of data-change to avoid full reset
            document.dispatchEvent(new Event('view-update'));
            Toast.show('سفارش با موفقیت ثبت شد', 'success');

        } catch (e) { console.error(e); alert('خطا در ثبت سفارش'); }
    },

    async delete(orderId) {
        if (confirm('سفارش حذف شود؟')) {
            try {
                await db.deleteOrder(orderId);

                // Local update
                state.data.stores.forEach(s => {
                    if (s.orders) {
                        s.orders = s.orders.filter(o => o.id != orderId);
                    }
                });

                document.dispatchEvent(new Event('view-update'));
                Toast.show('سفارش حذف شد', 'success');
            } catch (e) {
                console.error(e);
                Toast.show('خطا در حذف سفارش', 'error');
            }
        }
    },

    initListeners() {
        document.getElementById('addOrderItemBtn').addEventListener('click', () => this.addItem());
        document.getElementById('orderCountDown').addEventListener('click', () => {
            const input = document.getElementById('orderCartonCount');
            if (input.value > 1) input.value--;
        });
        document.getElementById('orderCountUp').addEventListener('click', () => {
            const input = document.getElementById('orderCartonCount');
            input.value++;
        });
        document.getElementById('saveOrderBtn').addEventListener('click', () => this.save());
    }
};
