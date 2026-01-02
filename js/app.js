import { db } from './services/db.js';
import { auth } from './services/auth.js';
import { state } from './core/state.js';
import { Toast } from './components/shared/Toast.js';
import { DashboardView } from './components/dashboard/DashboardView.js';
import { OrdersView } from './components/orders/OrdersView.js';
import { ManagementView } from './components/management/ManagementView.js';
import { VisitList } from './components/visits/VisitList.js';
import { VisitModal } from './components/visits/VisitModal.js';
import { OrderModal } from './components/orders/OrderModal.js';
import { RegionManager } from './components/settings/RegionManager.js';
import { ProductManager } from './components/settings/ProductManager.js';
import { SettingsModal } from './components/settings/SettingsModal.js';
import { AddStoreModal } from './components/dashboard/AddStoreModal.js';
import { exportToExcel, backupToExcel, parseExcelBackup, getBackupBlob } from './services/excel.js';
import { backupToJSON, parseJSONBackup } from './services/backup.js';
import { Utils } from './components/shared/Utils.js';
import { dateUtils } from './services/date_utils.js';

const App = {
    async init() {
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await auth.logout();
        });

        DashboardView.init();
        ManagementView.init(); // Initialize Management View listeners (including Statistics)
        OrdersView.initListeners();
        // VisitModal.initListeners(); // Moved to fix duplication issues - initialized only when needed or via dedicated setup
        OrderModal.initListeners();
        SettingsModal.initListeners();
        AddStoreModal.initListeners();

        // Prevent stacking VisitModal listeners by initializing it safely once if needed,
        // or relying on direct event handling.
        VisitModal.initListeners();

        document.getElementById('addRegionBtn').addEventListener('click', () => RegionManager.add());
        document.getElementById('addProductBtn').addEventListener('click', () => ProductManager.add());

        this.setupNavigation();
        await this.loadInitialData();
        this.setupGlobalDelegation();
        this.setupBackupHandlers();

        // Handle "Data Refresh" Button
        document.getElementById('refreshDataBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            const icon = btn.querySelector('i');
            icon.classList.add('spin-anim'); // Add simple rotation class if style allows, or just ignore animation
            try {
                await this.refreshData();
                Toast.show('اطلاعات بروزرسانی شد', 'success');
            } catch (err) {
                console.error(err);
                Toast.show('خطا در بروزرسانی', 'error');
            } finally {
                icon.classList.remove('spin-anim');
            }
        });

        document.addEventListener('data-change', async () => {
             await this.refreshData();
        });

        // New event for non-fetching UI updates
        document.addEventListener('view-update', () => {
             this.updateViews();
        });

        document.addEventListener('visit-log-updated', (e) => {
             this.refreshData(); // Log updates usually don't need full refresh but keeping for safety
        });

        // Listen for DB Schema Error
        document.addEventListener('db-schema-error', () => {
            // Show toast with button to open settings
            const container = document.getElementById('toastContainer');
            const id = 'toast-db-' + Date.now();
            const toastHtml = `
                <div id="${id}" class="toast align-items-center text-bg-warning border-0" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body">
                            <div>خطای ساختار دیتابیس (visit_type).</div>
                            <div class="small mt-1">برای عملکرد صحیح دکمه زیر را زده و اسکریپت را اجرا کنید.</div>
                            <button class="btn btn-sm btn-dark mt-2 w-100" onclick="document.dispatchEvent(new CustomEvent('open-sql-modal'))">تعمیر دیتابیس</button>
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', toastHtml);
            const toastEl = document.getElementById(id);
            const toast = new bootstrap.Toast(toastEl, { delay: 15000 }); // Longer delay
            toast.show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        });

        // Helper event to open SQL modal from Toast button (since onclick string scope is global window)
        document.addEventListener('open-sql-modal', () => {
            SettingsModal.showSqlModal();
        });
    },

    setupNavigation() {
        const views = {
            'dashboard': DashboardView,
            'orders': OrdersView,
            'management': ManagementView
        };

        const switchView = (viewName) => {
            Object.values(views).forEach(v => v.hide());
            if (views[viewName]) {
                views[viewName].show();
            }
        };

        document.getElementById('dailySalesBtn').addEventListener('click', () => this.showDailySales());
        document.getElementById('ordersViewBtn').addEventListener('click', () => switchView('orders'));
        document.getElementById('managementViewBtn').addEventListener('click', () => switchView('management'));

        document.querySelectorAll('.back-to-dash-btn').forEach(btn => {
            btn.addEventListener('click', () => switchView('dashboard'));
        });
    },

    async loadInitialData() {
        try {
            // Disabled LocalStorage Cache to ensure DB synchronization
            let regions = [], products = [];
            try {
                [regions, products] = await Promise.all([
                    db.getRegions(),
                    db.getProducts()
                ]);
            } catch (e) {
                console.warn("Initial aux fetch failed, retrying...", e);
                [regions, products] = await Promise.all([
                    db.getRegions(),
                    db.getProducts()
                ]);
            }

            state.data.regions = regions || [];
            state.data.products = products || [];

            // Removed localStorage writes

            try {
                // Visits are now fetched directly by VisitList.render(), but we keep state.data.visits populated
                // for notifications and other utils if needed.
                // However, VisitList should be the source of truth for the list view.
                state.data.visits = await db.getVisits() || [];
            } catch (err) {
                console.warn('Could not load visits', err);
                if (err.code === 'PGRST205' || (err.message && err.message.includes('Could not find the table'))) {
                    Toast.show('توجه: جدول ویزیت‌ها هنوز ایجاد نشده است. به تنظیمات بروید.', 'warning');
                }
            }

            RegionManager.render();
            ProductManager.render();
            await VisitList.render(); // Make this await as it fetches data now

            this.checkVisitNotifications();

        } catch (error) {
            console.error('Error loading data:', error);
            Toast.show('خطا در بارگذاری اطلاعات.', 'error');
        }
    },

    async refreshData() {
        await this.loadInitialData();
        state.resetPagination();
        await import('./components/dashboard/StoreList.js').then(m => m.StoreList.loadChunk(false));
        this.updateViews();
    },

    updateViews() {
        if (!document.getElementById('managementView').classList.contains('d-none')) {
            import('./components/management/StoreTable.js').then(m => m.StoreTable.render());
        }
        if (!document.getElementById('ordersView').classList.contains('d-none')) {
            OrdersView.render();
        }
        if (!document.getElementById('dashboardView').classList.contains('d-none')) {
             import('./components/dashboard/StoreList.js').then(m => m.StoreList.render());
        }
        // Also refresh Visits if modal or list is visible (though VisitList is usually static on sidebar/modal)
         VisitList.render();
    },

    checkVisitNotifications() {
        // We use state.data.visits which was populated in loadInitialData
        const tomorrow = dateUtils.getTomorrowJalaali();
        const upcoming = state.data.visits.filter(v => v.visit_date === tomorrow && v.status !== 'done');

        if (upcoming.length > 0) {
            const names = upcoming.map(v => v.store?.name).slice(0, 3).join('، ');
            const more = upcoming.length > 3 ? ` و ${upcoming.length - 3} مورد دیگر` : '';
            Toast.show(`یادآوری: فردا ${upcoming.length} قرار ویزیت دارید (${names}${more})`, 'info');
        }
    },

    setupBackupHandlers() {
        document.getElementById('exportReportBtn').addEventListener('click', () => exportToExcel(state.data.stores));
        document.getElementById('backupJsonBtn').addEventListener('click', () => backupToJSON(state.data));

        document.getElementById('importJsonInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!confirm('آیا مطمئن هستید؟ داده‌های وارد شده اضافه/بروزرسانی خواهند شد.')) return;
            try {
                const data = await parseJSONBackup(file);
                if (data) {
                    await db.importData(data);
                    Toast.show('بازگردانی با موفقیت انجام شد.', 'success');
                    await this.refreshData();
                }
            } catch (error) { console.error(error); Toast.show('خطا در بازگردانی فایل.', 'error'); }
            e.target.value = '';
        });

        document.getElementById('backupExcelBtn').addEventListener('click', async () => {
             const fullData = await db.getAllData();
             backupToExcel(fullData);
        });

        document.getElementById('importExcelInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!confirm('آیا مطمئن هستید؟ داده‌های وارد شده اضافه/بروزرسانی خواهند شد.')) return;
            try {
                const data = await parseExcelBackup(file);
                if (data) {
                    await db.importData(data);
                    Toast.show('بازگردانی با موفقیت انجام شد.', 'success');
                    await this.refreshData();
                }
            } catch (error) { console.error(error); Toast.show('خطا در بازگردانی فایل.', 'error'); }
            e.target.value = '';
        });

        document.getElementById('sendBackupToTelegramBtn').addEventListener('click', () => this.handleSendBackupToTelegram());
        document.getElementById('sendOrdersToTelegramBtn').addEventListener('click', () => this.handleSendOrdersToTelegram());
        document.getElementById('sendVisitsToTelegramBtn').addEventListener('click', () => this.handleSendVisitsToTelegram());
    },

    setupGlobalDelegation() {
        document.body.addEventListener('click', async (e) => {
            const btn = e.target.closest('button') || e.target.closest('input[type="checkbox"]');
            if (!btn) return;

            const action = btn.dataset.action;
            if (!action) return;

            if (action === 'delete-region') RegionManager.delete(btn.dataset.id);
            else if (action === 'delete-product') ProductManager.delete(btn.dataset.id);
            else if (action === 'edit-store') AddStoreModal.open(btn.dataset.storeId);
            else if (action === 'new-order') OrderModal.open(btn.dataset.storeId);
            else if (action === 'edit-order') OrderModal.open(btn.dataset.storeId, btn.dataset.orderId);
            else if (action === 'delete-order') OrderModal.delete(btn.dataset.orderId);
            else if (action === 'delete-store') {
                 if (confirm('آیا از حذف فروشگاه و تمام سفارشات آن اطمینان دارید؟')) {
                     await db.deleteStore(btn.dataset.storeId);
                     document.dispatchEvent(new Event('data-change'));
                 }
            }
            else if (action === 'new-visit') VisitModal.open(btn.dataset.storeId);
            else if (action === 'show-details') this.openStoreDetails(btn.dataset.storeId);
            else if (action === 'delete-visit') VisitList.handleAction('delete-visit', btn.dataset.id);
            else if (action === 'complete-visit') VisitList.handleAction('complete-visit', btn.dataset.id);
            else if (action === 'delete-log') VisitModal.deleteLog(btn.dataset.storeId, btn.dataset.id);
            else if (action === 'edit-log') VisitModal.openEditLog(btn.dataset.storeId, btn.dataset.id);
        });
    },

    openStoreDetails(storeId) {
        const store = state.data.stores.find(s => s.id == storeId);
        if (!store) return;

        document.getElementById('detailName').textContent = store.name || '-';
        document.getElementById('detailRegion').textContent = store.region || '-';
        document.getElementById('detailSeller').textContent = store.seller_name || '-';
        document.getElementById('detailPhone').textContent = store.phone || '-';
        document.getElementById('detailAddress').textContent = store.address || '-';
        document.getElementById('detailDesc').textContent = store.description || '-';

        const ordersList = document.getElementById('detailOrdersList');
        ordersList.innerHTML = '';

        if (store.orders && store.orders.length > 0) {
            store.orders.slice().sort((a,b) => b.id - a.id).forEach(o => {
                let itemsText = '';
                if (o.items && o.items.length > 0) {
                     itemsText = o.items.map(i => `<span class="badge bg-light text-dark border me-1">${i.count} ${Utils.escapeHtml(i.productName)}</span>`).join('');
                }

                const item = document.createElement('div');
                item.className = 'list-group-item px-0';
                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold small">${Utils.escapeHtml(o.date)}</span>
                        <div class="text-muted small">${Utils.escapeHtml(o.text || '')}</div>
                    </div>
                    <div class="mb-2">${itemsText}</div>
                    <div class="d-flex justify-content-end gap-2">
                         <button class="btn btn-sm btn-outline-primary" data-action="edit-order" data-store-id="${store.id}" data-order-id="${o.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-order" data-order-id="${o.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;
                ordersList.appendChild(item);
            });
        } else {
            ordersList.innerHTML = '<div class="text-center text-muted py-3 small">سفارشی ثبت نشده است</div>';
        }

        // Logs
        let logsContainer = document.getElementById('detailVisitLogs');
        if (!logsContainer) {
            logsContainer = document.createElement('div');
            logsContainer.id = 'detailVisitLogs';
            logsContainer.className = 'mt-3 pt-3 border-top';
            ordersList.parentNode.appendChild(logsContainer);
        }

        logsContainer.innerHTML = '<h6 class="mb-2 fw-bold text-secondary">تاریخچه ویزیت‌ها</h6>';
        const logsList = document.createElement('div');
        logsList.className = 'list-group list-group-flush small';

        if (store.visit_logs && store.visit_logs.length > 0) {
             store.visit_logs.forEach(log => {
                 const logDate = new Date(log.visited_at);
                 const jalaaliDate = dateUtils.toJalaali(logDate);
                 const timeStr = logDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

                 // Show visit type icon/badge
                 let typeBadge = '';
                 if (log.visit_type === 'phone' || (log.note && log.note.includes('ویزیت تلفنی'))) {
                     typeBadge = '<span class="badge bg-warning text-dark me-2">تلفنی</span>';
                 } else {
                     typeBadge = '<span class="badge bg-info text-dark me-2">حضوری</span>';
                 }

                 const item = document.createElement('div');
                 item.className = 'list-group-item px-0';
                 item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            ${typeBadge}
                            <span class="fw-bold">${jalaaliDate}</span> <span class="small ms-1">${timeStr}</span>
                            ${log.note ? `<div class="small text-primary mt-1">${Utils.escapeHtml(log.note)}</div>` : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-link text-primary p-0 me-2" data-action="edit-log" data-store-id="${store.id}" data-id="${log.id}">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="btn btn-sm btn-link text-danger p-0" data-action="delete-log" data-store-id="${store.id}" data-id="${log.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                 `;
                 logsList.appendChild(item);
             });
        } else {
             logsList.innerHTML = '<div class="text-center text-muted py-2 small">تاریخچه‌ای موجود نیست</div>';
        }
        logsContainer.appendChild(logsList);

        new bootstrap.Modal(document.getElementById('storeDetailsModal')).show();
    },

    showDailySales() {
         const todayJalaali = dateUtils.toJalaali(new Date());
         const todayLocale = new Date().toLocaleDateString('fa-IR');

         let count = 0;
         let products = {};

         state.data.stores.forEach(s => {
             if (s.orders) {
                 s.orders.forEach(o => {
                     if (o.date === todayJalaali || o.date === todayLocale) {
                         count++;
                         if (o.items) {
                             o.items.forEach(i => {
                                 products[i.productName] = (products[i.productName] || 0) + i.count;
                             });
                         }
                     }
                 });
             }
         });

         let html = `<div class="alert alert-info text-center"><h4>${count}</h4><small>سفارشات امروز</small></div>`;
         if (Object.keys(products).length) {
             html += '<ul class="list-group">';
             for (const [name, qty] of Object.entries(products)) {
                 html += `<li class="list-group-item d-flex justify-content-between">${name} <span class="badge bg-primary">${qty}</span></li>`;
             }
             html += '</ul>';
         }

         document.getElementById('dailySalesContent').innerHTML = html;
         new bootstrap.Modal(document.getElementById('dailySalesModal')).show();
    },

    async handleSendBackupToTelegram() {
        const token = localStorage.getItem('bolt_telegram_token');
        const userId = localStorage.getItem('bolt_telegram_userid');

        if (!token || !userId) {
            Toast.show('لطفاً ابتدا توکن ربات و شناسه کاربری را در تنظیمات وارد کنید.', 'error');
            return;
        }

        try {
            const btn = document.getElementById('sendBackupToTelegramBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> در حال تهیه و ارسال...';
            btn.disabled = true;

            const fullData = await db.getAllData();
            const blob = await getBackupBlob(fullData);
            const formData = new FormData();
            formData.append('chat_id', userId);
            formData.append('document', blob, `Backup_${new Date().toISOString().slice(0,10)}.xlsx`);
            formData.append('caption', '📦 نسخه پشتیبان جدید (اکسل)');

            const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                method: 'POST',
                body: formData
            });

            const resData = await response.json();

            if (resData.ok) {
                Toast.show('فایل پشتیبان با موفقیت به تلگرام ارسال شد.', 'success');
            } else {
                console.error('Telegram Error:', resData);
                Toast.show('خطا در ارسال فایل به تلگرام.', 'error');
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
        } catch (error) {
            console.error(error);
            Toast.show('خطا در تهیه یا ارسال پشتیبان.', 'error');
            const btn = document.getElementById('sendBackupToTelegramBtn');
            if(btn) { btn.innerHTML = originalText || 'Send'; btn.disabled = false; }
        }
    },

    async handleSendOrdersToTelegram() {
        const token = localStorage.getItem('bolt_telegram_token');
        const userId = localStorage.getItem('bolt_telegram_userid');
        const count = parseInt(document.getElementById('telegramOrderCount').value) || 20;

        if (!token || !userId) {
            Toast.show('لطفاً ابتدا توکن ربات و شناسه کاربری را در تنظیمات وارد کنید.', 'error');
            return;
        }

        try {
            const btn = document.getElementById('sendOrdersToTelegramBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> دریافت...';
            btn.disabled = true;

            // Fetch ALL orders directly from DB (latest first)
            let allOrders = await db.getAllOrdersWithDetails();

            // Note: getAllOrdersWithDetails already returns flattened structure with storeName, etc.
            // And it is sorted by created_at DESC.

            // Limit count
            const ordersToSend = allOrders.slice(0, count);

            if (ordersToSend.length === 0) {
                Toast.show('سفارشی برای ارسال وجود ندارد.', 'warning');
                btn.innerHTML = originalText;
                btn.disabled = false;
                return;
            }

            let message = `📋 *لیست ${count} سفارش آخر*\n\n`;
            ordersToSend.forEach((o, i) => {
                 let itemsText = '-';
                 if (o.items && o.items.length) {
                     itemsText = o.items.map(it => `${it.count} ${it.productName}`).join('، ');
                 }
                 message += `${i+1}. *${o.storeName || 'نامشخص'}* (${o.storeRegion || '-'}) \n📞 ${o.storePhone || '-'}\n📍 ${o.storeAddress || '-'}\n📅 ${o.date}\n📦 ${itemsText}\n📝 ${o.text || ''}\n\n`;
            });

            this.sendTelegramMessage(token, userId, message, 'sendOrdersToTelegramBtn');

        } catch (e) {
            console.error(e);
            Toast.show('خطا در دریافت سفارشات برای ارسال', 'error');
            const btn = document.getElementById('sendOrdersToTelegramBtn');
            if(btn) { btn.innerHTML = 'ارسال به ربات'; btn.disabled = false; }
        }
    },

    async handleSendVisitsToTelegram() {
        const token = localStorage.getItem('bolt_telegram_token');
        const userId = localStorage.getItem('bolt_telegram_userid');
        const count = parseInt(document.getElementById('telegramVisitCount').value) || 20;

        if (!token || !userId) {
            Toast.show('لطفاً ابتدا توکن ربات و شناسه کاربری را در تنظیمات وارد کنید.', 'error');
            return;
        }

        const visitsToSend = state.data.visits.slice(0, count);

        if (visitsToSend.length === 0) {
            Toast.show('قراری برای ارسال وجود ندارد.', 'warning');
            return;
        }

        let message = `📅 *لیست ${count} قرار ویزیت*\n\n`;
        visitsToSend.forEach((v, i) => {
             const status = v.status === 'done' ? '✅ انجام شده' : '⏳ در انتظار';
             message += `${i+1}. *${v.store?.name || 'نامشخص'}* (${v.store?.region || '-'}) \n📅 ${v.visit_date} ⏰ ${v.visit_time || '-'}\n📝 ${v.note || ''}\n${status}\n\n`;
        });

        this.sendTelegramMessage(token, userId, message, 'sendVisitsToTelegramBtn');
    },

    async sendTelegramMessage(token, userId, text, btnId) {
        const btn = document.getElementById(btnId);
        const originalText = btn ? btn.innerHTML : 'ارسال'; // Safety check
        if (btn) {
             btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ارسال...';
             btn.disabled = true;
        }

        try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: userId,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });

            const resData = await response.json();
            if (resData.ok) {
                Toast.show('پیام به تلگرام ارسال شد.', 'success');
            } else {
                console.error('Telegram Error:', resData);
                Toast.show('خطا در ارسال به تلگرام.', 'error');
            }
        } catch (error) {
            console.error(error);
            Toast.show('خطا در ارتباط با سرور تلگرام.', 'error');
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }
};

export { App };
