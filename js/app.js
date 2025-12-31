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

// Telegram sending logic needs to be moved to a service or component.
// Since it uses UI elements (buttons), let's keep it in a helper or move it.
// I'll add a simple helper here or keep it in App for now as it's "Action" logic.

const App = {
    async init() {
        // Auth check happens in main.js usually, but here we can setup listeners
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await auth.logout();
        });

        // Initialize Components
        DashboardView.init(); // Sets up listeners and loads initial chunk
        OrdersView.initListeners();
        VisitModal.initListeners();
        OrderModal.initListeners();
        SettingsModal.initListeners();
        AddStoreModal.initListeners();

        // Settings / Add buttons
        document.getElementById('addRegionBtn').addEventListener('click', () => RegionManager.add());
        document.getElementById('addProductBtn').addEventListener('click', () => ProductManager.add());

        // Navigation
        this.setupNavigation();

        // Data Load
        await this.loadInitialData();

        // Global Event Listeners (Delegation)
        this.setupGlobalDelegation();

        // Import/Export
        this.setupBackupHandlers();

        // Custom events
        document.addEventListener('data-change', async () => {
             await this.refreshData();
        });
        document.addEventListener('visit-log-updated', (e) => {
             // If needed to refresh specific parts
             this.refreshData(); // brute force refresh
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
                // Special case for Management
                if (viewName === 'management') {
                    // Refresh stats maybe?
                }
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
            // Optimization: Load from cache first
            try {
                const cachedRegions = localStorage.getItem('bolt_regions');
                const products = localStorage.getItem('bolt_products');
                if (cachedRegions && products) {
                     state.data.regions = JSON.parse(cachedRegions);
                     state.data.products = JSON.parse(products);
                     RegionManager.render();
                     ProductManager.render();
                }
            } catch (e) { console.warn('Cache load failed', e); }

            // Fetch Fresh
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

            // Update Cache
            localStorage.setItem('bolt_regions', JSON.stringify(state.data.regions));
            localStorage.setItem('bolt_products', JSON.stringify(state.data.products));

            try {
                state.data.visits = await db.getVisits() || [];
            } catch (err) {
                console.warn('Could not load visits', err);
                if (err.code === 'PGRST205' || (err.message && err.message.includes('Could not find the table'))) {
                    Toast.show('توجه: جدول ویزیت‌ها هنوز ایجاد نشده است. به تنظیمات بروید.', 'warning');
                }
            }

            RegionManager.render();
            ProductManager.render();
            VisitList.render();

            // Check notifications
            this.checkVisitNotifications();

        } catch (error) {
            console.error('Error loading data:', error);
            Toast.show('خطا در بارگذاری اطلاعات.', 'error');
        }
    },

    async refreshData() {
        await this.loadInitialData();
        // Reload stores depending on view?
        // Since we have pagination, full reload clears it.
        // Let's just re-render visible stuff.
        state.resetPagination();
        await import('./components/dashboard/StoreList.js').then(m => m.StoreList.loadChunk());
        // Also update Management table if visible
        if (!document.getElementById('managementView').classList.contains('d-none')) {
            import('./components/management/StoreTable.js').then(m => m.StoreTable.render());
        }
        if (!document.getElementById('ordersView').classList.contains('d-none')) {
            OrdersView.render();
        }
    },

    checkVisitNotifications() {
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

            // Shared actions
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

                 const item = document.createElement('div');
                 item.className = 'list-group-item px-0';
                 item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
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

    // Telegram Logic (Copied/Adapted from ui.js)
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

        let allOrders = [];
        state.data.stores.forEach(store => {
            if (store.orders) {
                store.orders.forEach(order => {
                    allOrders.push({
                        ...order,
                        storeName: store.name,
                        storeRegion: store.region
                    });
                });
            }
        });

        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const ordersToSend = allOrders.slice(0, count);

        if (ordersToSend.length === 0) {
            Toast.show('سفارشی برای ارسال وجود ندارد.', 'warning');
            return;
        }

        let message = `📋 *لیست ${count} سفارش آخر*\n\n`;
        ordersToSend.forEach((o, i) => {
             let itemsText = '-';
             if (o.items && o.items.length) {
                 itemsText = o.items.map(it => `${it.count} ${it.productName}`).join('، ');
             }
             message += `${i+1}. *${o.storeName}* (${o.storeRegion})\n📅 ${o.date}\n📦 ${itemsText}\n📝 ${o.text || ''}\n\n`;
        });

        this.sendTelegramMessage(token, userId, message, 'sendOrdersToTelegramBtn');
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
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ارسال...';
        btn.disabled = true;

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
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

export { App };
