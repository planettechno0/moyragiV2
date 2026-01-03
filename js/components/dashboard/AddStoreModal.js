import { db } from '../../services/db.js';
import { state } from '../../core/state.js';
import { Toast } from '../shared/Toast.js';
import { StoreList } from '../dashboard/StoreList.js';

export const AddStoreModal = {
    open(storeId = null) {
        const form = document.getElementById('addStoreForm');
        form.reset();
        document.querySelectorAll('.store-day-check').forEach(cb => cb.checked = false);

        // Clean up any existing delete button
        const oldDeleteBtn = document.getElementById('deleteStoreInModalBtn');
        if (oldDeleteBtn) oldDeleteBtn.remove();

        if (storeId) {
            const store = state.data.stores.find(s => s.id == storeId);
            if (store) {
                document.getElementById('storeId').value = store.id;
                document.getElementById('storeName').value = store.name;
                document.getElementById('storeDescription').value = store.description || '';
                document.getElementById('storeSellerName').value = store.seller_name || '';
                document.getElementById('storeAddress').value = store.address || '';
                document.getElementById('storePhone').value = store.phone || '';
                document.getElementById('storeRegion').value = store.region;
                document.getElementById('storeIdealTime').value = store.ideal_time || '';
                document.getElementById('storePurchaseProb').value = store.purchase_prob || '';
                document.getElementById('storeModalTitle').textContent = 'ویرایش فروشگاه';

                if (store.visit_days) {
                    store.visit_days.forEach(d => {
                        const cb = document.getElementById(`d${d}`);
                        if (cb) cb.checked = true;
                    });
                }

                // Add Delete Button
                const footer = document.querySelector('#addStoreModal .modal-footer');
                const deleteBtn = document.createElement('button');
                deleteBtn.id = 'deleteStoreInModalBtn';
                deleteBtn.className = 'btn btn-outline-danger me-auto';
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i> حذف فروشگاه';
                deleteBtn.onclick = async () => {
                    if (confirm('آیا از حذف این فروشگاه اطمینان دارید؟')) {
                        try {
                            await db.deleteStore(store.id);
                            Toast.show('فروشگاه حذف شد.', 'success');
                            bootstrap.Modal.getInstance(document.getElementById('addStoreModal')).hide();
                            document.dispatchEvent(new Event('data-change'));
                        } catch (err) {
                            console.error(err);
                            Toast.show('خطا در حذف فروشگاه', 'error');
                        }
                    }
                };
                footer.insertBefore(deleteBtn, footer.firstChild);
            }
        } else {
            document.getElementById('storeId').value = '';
            document.getElementById('storeModalTitle').textContent = 'ثبت فروشگاه جدید';
        }

        new bootstrap.Modal(document.getElementById('addStoreModal')).show();
    },

    async save() {
        const btn = document.getElementById('saveStoreBtn');
        if (btn.disabled) return;

        const id = document.getElementById('storeId').value;
        const name = document.getElementById('storeName').value.trim();
        const region = document.getElementById('storeRegion').value;

        if (!name || !region) {
            Toast.show('نام و منطقه الزامی است.', 'error');
            return;
        }

        const visitDays = [];
        document.querySelectorAll('.store-day-check:checked').forEach(cb => visitDays.push(parseInt(cb.value)));

        const storeData = {
            name,
            region,
            description: document.getElementById('storeDescription').value,
            sellerName: document.getElementById('storeSellerName').value,
            address: document.getElementById('storeAddress').value,
            phone: document.getElementById('storePhone').value,
            idealTime: document.getElementById('storeIdealTime').value,
            purchaseProb: document.getElementById('storePurchaseProb').value,
            visitDays
        };

        // Prevent Double Submit
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ذخیره...';

        try {
            if (id) {
                await db.updateStore(id, storeData);
                Toast.show('فروشگاه با موفقیت ویرایش شد.', 'success');
            } else {
                await db.addStore(storeData);
                Toast.show('فروشگاه جدید ثبت شد.', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('addStoreModal')).hide();
            document.dispatchEvent(new Event('data-change'));
        } catch (err) {
            console.error(err);
            Toast.show('خطا در ذخیره سازی', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    initListeners() {
        // Use onclick to prevent duplicate event listeners if initListeners is called multiple times
        document.getElementById('saveStoreBtn').onclick = () => this.save();
        document.getElementById('addStoreBtn').onclick = () => this.open();
    }
};
