import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { Utils } from '../shared/Utils.js';
import { Toast } from '../shared/Toast.js';

export const OrdersView = {
    async render() {
        const list = document.getElementById('allOrdersList');
        const noMsg = document.getElementById('noOrdersMsg');
        const dateFilter = document.getElementById('orderDateFilter').value;

        // Show loading state
        list.innerHTML = '<tr><td colspan="6" class="text-center"><span class="spinner-border spinner-border-sm text-primary"></span> در حال دریافت اطلاعات...</td></tr>';
        noMsg.classList.add('d-none');

        try {
            // Fetch ALL orders directly from DB
            let allOrders = await db.getAllOrdersWithDetails();

            // Apply Client-Side Filtering
            if (dateFilter) {
                // Normalize: 1402/1/1 -> 1402/01/01
                const parts = dateFilter.split('/');
                if (parts.length === 3) {
                    const y = parts[0];
                    const m = parts[1].padStart(2, '0');
                    const d = parts[2].padStart(2, '0');
                    const normDate = `${y}/${m}/${d}`;
                    allOrders = allOrders.filter(o => o.date === normDate || o.date === dateFilter);
                } else {
                    allOrders = allOrders.filter(o => o.date && o.date.includes(dateFilter));
                }
            }

            // Render
            list.innerHTML = '';
            if (allOrders.length === 0) {
                noMsg.classList.remove('d-none');
            } else {
                noMsg.classList.add('d-none');

                // Use document fragment for performance
                const fragment = document.createDocumentFragment();

                allOrders.forEach(order => {
                    let itemsText = '-';
                    if (order.items && order.items.length) {
                        itemsText = order.items.map(i => `${i.count} ${Utils.escapeHtml(i.productName)}`).join('، ');
                    }
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${Utils.escapeHtml(order.date)}</td>
                        <td>${Utils.escapeHtml(order.storeName || 'نامشخص')}</td>
                        <td><small class="text-muted">${Utils.escapeHtml(order.storeAddress || '-')}</small></td>
                        <td><small>${itemsText}</small></td>
                        <td><small class="text-muted">${Utils.escapeHtml(order.text || '')}</small></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-order" data-store-id="${order.store_id}" data-order-id="${order.id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" data-action="delete-order" data-order-id="${order.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    `;
                    fragment.appendChild(tr);
                });
                list.appendChild(fragment);
            }
        } catch (error) {
            console.error(error);
            list.innerHTML = '<tr><td colspan="6" class="text-center text-danger">خطا در دریافت سفارشات</td></tr>';
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
        const dateInput = document.getElementById('orderDateFilter');

        // Init KamaDatepicker
        if (typeof kamaDatepicker === 'function') {
            kamaDatepicker('orderDateFilter', {
                buttonsColor: "blue",
                forceFarsiDigits: true,
                markToday: true,
                markHolidays: true,
                highlightSelectedDay: true,
                sync: true,
                gotoToday: true
            });
        }

        ['change', 'input', 'blur'].forEach(evt => {
            dateInput.addEventListener(evt, () => this.render());
        });
    }
};
