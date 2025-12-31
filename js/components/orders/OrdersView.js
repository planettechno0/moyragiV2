import { db } from '../../db.js';
import { state } from '../../core/state.js';
import { Utils } from '../shared/Utils.js';
import { Toast } from '../shared/Toast.js';

export const OrdersView = {
    render() {
        const list = document.getElementById('allOrdersList');
        const noMsg = document.getElementById('noOrdersMsg');
        const dateFilter = document.getElementById('orderDateFilter').value;

        let allOrders = [];
        state.data.stores.forEach(store => {
            if (store.orders) {
                store.orders.forEach(order => {
                    allOrders.push({
                        ...order,
                        storeName: store.name,
                        storeAddress: store.address,
                        storeId: store.id
                    });
                });
            }
        });

        if (dateFilter) {
            allOrders = allOrders.filter(o => o.date === dateFilter.trim());
        }

        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        list.innerHTML = '';
        if (allOrders.length === 0) {
            noMsg.classList.remove('d-none');
        } else {
            noMsg.classList.add('d-none');
            allOrders.forEach(order => {
                let itemsText = '-';
                if (order.items && order.items.length) {
                    itemsText = order.items.map(i => `${i.count} ${Utils.escapeHtml(i.productName)}`).join('، ');
                }
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.escapeHtml(order.date)}</td>
                    <td>${Utils.escapeHtml(order.storeName)}</td>
                    <td><small class="text-muted">${Utils.escapeHtml(order.storeAddress || '-')}</small></td>
                    <td><small>${itemsText}</small></td>
                    <td><small class="text-muted">${Utils.escapeHtml(order.text)}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-order" data-store-id="${order.storeId}" data-order-id="${order.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-order" data-order-id="${order.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                list.appendChild(tr);
            });
        }
    },

    show() {
        document.getElementById('ordersView').classList.remove('d-none');
        this.render();
    },

    hide() {
        document.getElementById('ordersView').classList.add('d-none');
    },

    initListeners() {
        document.getElementById('orderDateFilter').addEventListener('change', () => this.render());
    }
};
