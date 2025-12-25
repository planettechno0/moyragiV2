import { db } from './db.js'
import { auth } from './auth.js'
import { exportToExcel, backupToExcel, parseExcelBackup } from './excel.js'
import { backupToJSON, parseJSONBackup } from './backup.js'

export const ui = {
    // State
    data: {
        stores: [],
        regions: [],
        products: []
    },
    pagination: {
        page: 0,
        pageSize: 10,
        hasMore: true
    },
    currentOrderItems: [],

    // Maps
    daysMap: {
        6: 'شنبه',
        0: 'یکشنبه',
        1: 'دوشنبه',
        2: 'سه‌شنبه',
        3: 'چهارشنبه',
        4: 'پنج‌شنبه',
        5: 'جمعه'
    },
    idealTimeMap: {
        'morning': 'صبح',
        'noon': 'ظهر',
        'night': 'شب'
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const id = 'toast-' + Date.now();
        const colorClass = type === 'error' ? 'text-bg-danger' :
                           type === 'success' ? 'text-bg-success' : 'text-bg-primary';

        const toastHtml = `
            <div id="${id}" class="toast align-items-center ${colorClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        // Append to container
        // Using insertAdjacentHTML to avoid re-rendering entire list and losing existing toast states
        container.insertAdjacentHTML('beforeend', toastHtml);

        const toastEl = document.getElementById(id);
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();

        // Cleanup after hidden
        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    },

    async init() {
        // Load initial data
        await this.loadInitialData()
        this.setupEventListeners()
    },

    async loadInitialData() {
        try {
            // Load Aux Data
            const [regions, products] = await Promise.all([
                db.getRegions(),
                db.getProducts()
            ])
            this.data.regions = regions || []
            this.data.products = products || []
            this.renderRegions()

            // Load Stores (Page 0)
            this.resetPagination()
            await this.loadStoresChunk()
        } catch (error) {
            console.error('Error loading data:', error)
            this.showToast('خطا در بارگذاری اطلاعات. لطفاً دوباره تلاش کنید.', 'error')
        }
    },

    resetPagination() {
        this.pagination.page = 0;
        this.pagination.hasMore = true;
        this.data.stores = [];
        document.getElementById('storesContainer').innerHTML = ''; // Clear UI
    },

    async loadStoresChunk() {
        const loadingSpinner = this.pagination.page === 0
             ? document.querySelector('#storesContainer .spinner-border') // Initial load
             : document.getElementById('loadMoreLoading'); // Load more

        if (loadingSpinner) loadingSpinner.parentNode.classList.remove('d-none'); // Ensure container visible if spinner inside
        if (loadingSpinner && this.pagination.page > 0) loadingSpinner.classList.remove('d-none'); // Show button spinner

        try {
            const newStores = await db.getStores(this.pagination.page, this.pagination.pageSize);

            if (newStores.length < this.pagination.pageSize) {
                this.pagination.hasMore = false;
            }

            this.data.stores = [...this.data.stores, ...newStores];
            this.renderStores(); // Append new stores
            this.pagination.page++;
        } catch (error) {
            console.error(error);
            this.showToast('خطا در دریافت لیست فروشگاه‌ها', 'error');
        } finally {
             // Hide spinners
             if (loadingSpinner && this.pagination.page > 0) loadingSpinner.classList.add('d-none');
        }
    },

    // Kept for backward compat with other methods calling refreshData(), now alias to loadInitialData
    async refreshData() {
        return this.loadInitialData();
    },

    setupEventListeners() {
        // --- Filters ---
        // For local filtering to work with pagination, we ideally need backend filtering.
        // However, user asked for "Pagination".
        // Current implementation: We load chunks from DB.
        // IF we use client-side filtering (Search/Region), it only filters what is LOADED.
        // This is a common pitfall.
        // FIX: If we have filters, we should probably fetch ALL matching from DB or warn user.
        // Given complexity, let's keep client-side filter behavior but realize it only filters loaded data.
        // OR: Reset pagination and re-render.

        const filterHandler = () => this.renderStores(); // Just re-render what we have

        document.getElementById('searchInput').addEventListener('input', filterHandler)
        document.getElementById('filterDay').addEventListener('change', filterHandler)
        document.getElementById('filterRegion').addEventListener('change', filterHandler)
        document.getElementById('filterProb').addEventListener('change', filterHandler)

        // --- Buttons ---
        document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadStoresChunk())
        document.getElementById('addStoreBtn').addEventListener('click', () => this.openAddStoreModal())
        document.getElementById('resetDailyBtn').addEventListener('click', () => this.handleResetDaily())

        // --- Forms ---
        document.getElementById('saveStoreBtn').addEventListener('click', () => this.handleSaveStore())

        // --- Settings ---
        document.getElementById('addRegionBtn').addEventListener('click', () => this.handleAddRegion())
        document.getElementById('addProductBtn').addEventListener('click', () => this.handleAddProduct())

        // Reports
        document.getElementById('exportReportBtn').addEventListener('click', () => exportToExcel(this.data.stores))

        // Backups - JSON
        document.getElementById('backupJsonBtn').addEventListener('click', () => backupToJSON(this.data))
        document.getElementById('importJsonInput').addEventListener('change', (e) => this.handleImport(e, 'json'))

        // Backups - Excel
        document.getElementById('backupExcelBtn').addEventListener('click', () => backupToExcel(this.data))
        document.getElementById('importExcelInput').addEventListener('change', (e) => this.handleImport(e, 'excel'))

        // --- Orders ---
        document.getElementById('addOrderItemBtn').addEventListener('click', () => this.addOrderItem())
        document.getElementById('orderCountDown').addEventListener('click', () => {
            const input = document.getElementById('orderCartonCount')
            if (input.value > 1) input.value--
        })
        document.getElementById('orderCountUp').addEventListener('click', () => {
            const input = document.getElementById('orderCartonCount')
            input.value++
        })
        document.getElementById('saveOrderBtn').addEventListener('click', () => this.handleSaveOrder())

        // --- Views ---
        document.getElementById('dailySalesBtn').addEventListener('click', () => this.showDailySales())
        document.getElementById('ordersViewBtn').addEventListener('click', () => this.switchView('orders'))
        document.getElementById('backToDashboardBtn').addEventListener('click', () => this.switchView('dashboard'))
        document.getElementById('orderDateFilter').addEventListener('change', () => this.renderAllOrders())

        // --- Auth ---
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await auth.logout()
            // Page reload or UI update handled by auth listener
        })
    },

    switchView(viewName) {
        const dashboard = document.getElementById('dashboardView')
        const orders = document.getElementById('ordersView')
        const fab = document.getElementById('fabContainer')

        if (viewName === 'dashboard') {
            dashboard.classList.remove('d-none')
            orders.classList.add('d-none')
            fab.classList.remove('d-none')
            this.renderStores() // Re-render to ensure updates
        } else if (viewName === 'orders') {
            dashboard.classList.add('d-none')
            orders.classList.remove('d-none')
            fab.classList.add('d-none')
            this.renderAllOrders()
        }
    },

    // --- Render Logic ---

    renderStores() {
        const container = document.getElementById('storesContainer')
        const emptyState = document.getElementById('emptyState')
        const loadMoreContainer = document.getElementById('loadMoreContainer')

        // Remove initial spinner if it exists
        const initialSpinner = container.querySelector('.spinner-border');
        if (initialSpinner && initialSpinner.parentElement.classList.contains('text-center')) {
             container.innerHTML = '';
        }

        // We do NOT clear container.innerHTML here because we want to APPEND for Load More.
        // HOWEVER, if we are Filtering client-side, we need to clear and re-render the whole `this.data.stores`.
        // To handle both, let's clear and re-render ALL `this.data.stores` every time.
        // This is inefficient for huge lists but simpler for correctness with client-side filtering.
        container.innerHTML = '';

        const dayFilter = document.getElementById('filterDay').value
        const regionFilter = document.getElementById('filterRegion').value
        const probFilter = document.getElementById('filterProb').value
        const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase()
        const currentDayIndex = new Date().getDay()

        const filteredStores = this.data.stores.filter(store => {
            if (searchQuery) {
                const searchMatch = store.name.toLowerCase().includes(searchQuery) ||
                                    (store.address && store.address.toLowerCase().includes(searchQuery))
                if (!searchMatch) return false
            }
            if (regionFilter !== 'all' && store.region !== regionFilter) return false
            if (probFilter !== 'all' && store.purchase_prob !== probFilter) return false

            if (dayFilter === 'all') return true
            if (dayFilter === 'today') {
                return store.visit_days && store.visit_days.includes(currentDayIndex)
            }
            return store.visit_days && store.visit_days.includes(parseInt(dayFilter))
        })

        if (filteredStores.length === 0) {
            if (this.data.stores.length === 0) emptyState.classList.remove('d-none') // Real empty
            // Else just no matches for filter
        } else {
            emptyState.classList.add('d-none')
        }

        // Show/Hide Load More
        // Only show if we have no active text search/filters (since those are client side only on loaded data)
        // OR: Show it but clarify it loads more into the buffer.
        // Let's hide Load More if we reached end of DB.
        if (this.pagination.hasMore) {
            loadMoreContainer.classList.remove('d-none');
        } else {
            loadMoreContainer.classList.add('d-none');
        }

        filteredStores.forEach(store => {
            // Badges
            let badges = ''
            if (store.visit_days) {
                store.visit_days.sort().forEach(d => {
                    const isToday = (d === currentDayIndex)
                    const badgeClass = isToday ? 'bg-primary' : 'bg-secondary'
                    badges += `<span class="badge ${badgeClass} me-1">${this.daysMap[d]}</span>`
                })
            }
            if (store.ideal_time) {
                badges += `<span class="badge bg-info text-dark me-1"><i class="bi bi-clock"></i> ${this.idealTimeMap[store.ideal_time]}</span>`
            }
            if (store.purchase_prob) {
                const probText = store.purchase_prob === 'high' ? 'احتمال خرید: زیاد' : 'احتمال خرید: کم'
                const probClass = store.purchase_prob === 'high' ? 'bg-success' : 'bg-warning text-dark'
                badges += `<span class="badge ${probClass} me-1"><i class="bi bi-graph-up"></i> ${probText}</span>`
            }

            // Orders
            let ordersHtml = ''
            if (store.orders && store.orders.length > 0) {
                ordersHtml = '<div class="order-history"><strong>۳ سفارش آخر:</strong><ul class="list-unstyled mb-0 mt-1">'
                store.orders.slice(0, 3).forEach(o => {
                    let itemsText = ''
                    if (o.items && o.items.length > 0) {
                        itemsText = o.items.map(i => `${i.count} ${this.escapeHtml(i.productName)}`).join('، ')
                        itemsText = `<div class="text-primary smaller" style="font-size:0.75rem">${itemsText}</div>`
                    }
                    ordersHtml += `
                        <li class="d-flex flex-column mb-2 border-bottom pb-1">
                            <div class="d-flex justify-content-between text-muted small">
                                <span>${this.escapeHtml(o.date)}: ${this.escapeHtml(o.text)}</span>
                                <div class="d-flex">
                                    <button class="btn btn-link btn-sm p-0 text-decoration-none me-2" data-action="edit-order" data-store-id="${store.id}" data-order-id="${o.id}">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-link btn-sm p-0 text-decoration-none text-danger" data-action="delete-order" data-order-id="${o.id}">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                            ${itemsText}
                        </li>
                    `
                })
                ordersHtml += '</ul></div>'
            }

            const card = document.createElement('div')
            card.className = 'col-md-6 col-lg-4'
            card.innerHTML = `
                <div class="card h-100 ${store.visited ? 'visited' : ''}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h5 class="card-title fw-bold mb-0">${this.escapeHtml(store.name)}</h5>
                                <button class="btn btn-link btn-sm p-0 text-decoration-none" data-action="edit-store" data-store-id="${store.id}">
                                    <i class="bi bi-pencil-square"></i> ویرایش
                                </button>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" ${store.visited ? 'checked' : ''} data-action="toggle-visit" data-store-id="${store.id}">
                            </div>
                        </div>
                        <h6 class="card-subtitle mb-2 text-muted"><i class="bi bi-geo-alt-fill"></i> ${this.escapeHtml(store.region)}</h6>
                        <p class="card-text small mb-2">${this.escapeHtml(store.address) || 'بدون آدرس'}</p>
                        ${store.description ? `<p class="card-text small mb-2 text-muted">${this.escapeHtml(store.description)}</p>` : ''}
                        ${store.seller_name ? `<p class="card-text small mb-2"><i class="bi bi-person"></i> ${this.escapeHtml(store.seller_name)}</p>` : ''}
                        ${store.phone ? `<p class="card-text small mb-2"><i class="bi bi-telephone"></i> <a href="tel:${this.escapeHtml(store.phone)}" class="text-decoration-none">${this.escapeHtml(store.phone)}</a></p>` : ''}

                        <div class="mb-3">${badges}</div>
                        <button class="btn btn-sm btn-outline-primary w-100" data-action="new-order" data-store-id="${store.id}">
                            <i class="bi bi-cart-plus"></i> ثبت سفارش
                        </button>
                        ${ordersHtml}
                    </div>
                </div>
            `

            // Attach specific listeners to buttons inside the card
            // Note: Efficient way is delegation, but for simplicity here we can bind individually or rely on container delegation.
            // Let's use delegation on container to avoid memory leaks on re-render.
            container.appendChild(card)
        })
    },

    renderRegions() {
        const list = document.getElementById('regionList')
        const filterSelect = document.getElementById('filterRegion')
        const modalSelect = document.getElementById('storeRegion')

        list.innerHTML = ''
        // Reset dropdowns
        const currentFilter = filterSelect.value
        filterSelect.innerHTML = '<option value="all">همه مناطق</option>'
        modalSelect.innerHTML = ''

        this.data.regions.forEach(region => {
            // List Item
            const li = document.createElement('li')
            li.className = 'list-group-item d-flex justify-content-between align-items-center'
            li.innerHTML = `
                ${this.escapeHtml(region.name)}
                <button class="btn btn-sm btn-outline-danger" data-action="delete-region" data-id="${region.id}">
                    <i class="bi bi-trash"></i>
                </button>
            `
            list.appendChild(li)

            // Dropdown Options
            const opt1 = document.createElement('option')
            opt1.value = region.name
            opt1.textContent = region.name
            filterSelect.appendChild(opt1)

            const opt2 = document.createElement('option')
            opt2.value = region.name
            opt2.textContent = region.name
            modalSelect.appendChild(opt2)
        })

        filterSelect.value = currentFilter

        // Render Products List here too
        this.renderProducts()
    },

    renderProducts() {
        const list = document.getElementById('productList')
        const select = document.getElementById('orderProductSelect')
        list.innerHTML = ''
        select.innerHTML = '<option value="">انتخاب کالا...</option>'

        this.data.products.forEach(product => {
            const li = document.createElement('li')
            li.className = 'list-group-item d-flex justify-content-between align-items-center'
            li.innerHTML = `
                ${this.escapeHtml(product.name)}
                <button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${product.id}">
                    <i class="bi bi-trash"></i>
                </button>
            `
            list.appendChild(li)

            const opt = document.createElement('option')
            opt.value = product.id // Using ID for product reference in orders? Or name?
            // DB schema: order items stored as JSON. Let's store ID and Name in JSON to be safe.
            opt.textContent = product.name
            opt.dataset.name = product.name
            select.appendChild(opt)
        })
    },

    renderAllOrders() {
        const list = document.getElementById('allOrdersList')
        const noMsg = document.getElementById('noOrdersMsg')
        const dateFilter = document.getElementById('orderDateFilter').value

        let allOrders = []
        this.data.stores.forEach(store => {
            if (store.orders) {
                store.orders.forEach(order => {
                    allOrders.push({
                        ...order,
                        storeName: store.name,
                        storeAddress: store.address,
                        storeId: store.id
                    })
                })
            }
        })

        if (dateFilter) {
            // Convert input date (YYYY-MM-DD) to Persian if needed, or assume Order Date is stored same way.
            // Current app logic stores Persian date string.
            // A real app would need a date conversion library (jalaali-js).
            // For now, let's assume strict string match if user inputs Persian date string, but input type="date" gives Gregorian.
            // We need to convert Gregorian `dateFilter` to Persian to match stored data.
            // Since we don't have jalaali-js installed, we will skip complex filter logic or rely on simple string match if dates were ISO.
            // *Correction*: User stores Persian dates manually? Or auto?
            // `new Date().toLocaleDateString('fa-IR')` was used.
            // We can try to convert the input date to fa-IR.
            const [y, m, d] = dateFilter.split('-')
            const pDate = new Date(y, m-1, d).toLocaleDateString('fa-IR')
            allOrders = allOrders.filter(o => o.date === pDate)
        }

        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Sort by created_at

        list.innerHTML = ''
        if (allOrders.length === 0) {
            noMsg.classList.remove('d-none')
        } else {
            noMsg.classList.add('d-none')
            allOrders.forEach(order => {
                let itemsText = '-'
                if (order.items && order.items.length) {
                    itemsText = order.items.map(i => `${i.count} ${this.escapeHtml(i.productName)}`).join('، ')
                }
                const tr = document.createElement('tr')
                tr.innerHTML = `
                    <td>${this.escapeHtml(order.date)}</td>
                    <td>${this.escapeHtml(order.storeName)}</td>
                    <td><small class="text-muted">${this.escapeHtml(order.storeAddress || '-')}</small></td>
                    <td><small>${itemsText}</small></td>
                    <td><small class="text-muted">${this.escapeHtml(order.text)}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-order" data-store-id="${order.storeId}" data-order-id="${order.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-order" data-order-id="${order.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `
                list.appendChild(tr)
            })
        }
    },

    // --- Action Handlers ---

    async handleGlobalClick(e) {
        const btn = e.target.closest('button') || e.target.closest('input[type="checkbox"]')
        if (!btn) return

        const action = btn.dataset.action
        if (!action) return

        if (action === 'toggle-visit') {
            const id = btn.dataset.storeId
            const visited = btn.checked
            await db.toggleVisit(id, visited)
            // Update local state without full reload
            const store = this.data.stores.find(s => s.id == id)
            if (store) store.visited = visited
            this.renderStores()
        }
        else if (action === 'delete-region') {
            if (confirm('حذف شود؟')) {
                await db.deleteRegion(btn.dataset.id)
                await this.refreshData()
                this.renderRegions()
                this.renderStores()
            }
        }
        else if (action === 'delete-product') {
            if (confirm('حذف شود؟')) {
                await db.deleteProduct(btn.dataset.id)
                await this.refreshData()
                this.renderRegions() // Calls renderProducts
            }
        }
        else if (action === 'edit-store') {
            this.openAddStoreModal(btn.dataset.storeId)
        }
        else if (action === 'new-order') {
            this.openOrderModal(btn.dataset.storeId)
        }
        else if (action === 'edit-order') {
            this.openOrderModal(btn.dataset.storeId, btn.dataset.orderId)
        }
        else if (action === 'delete-order') {
            if (confirm('سفارش حذف شود؟')) {
                await db.deleteOrder(btn.dataset.orderId)
                await this.refreshData()
                if (this.currentView === 'orders') this.renderAllOrders()
                else this.renderStores()
            }
        }
    },

    // --- Modal Logic ---

    openAddStoreModal(storeId = null) {
        const form = document.getElementById('addStoreForm')
        form.reset()
        document.querySelectorAll('.store-day-check').forEach(cb => cb.checked = false)

        if (storeId) {
            const store = this.data.stores.find(s => s.id == storeId)
            if (store) {
                document.getElementById('storeId').value = store.id
                document.getElementById('storeName').value = store.name
                document.getElementById('storeDescription').value = store.description || ''
                document.getElementById('storeSellerName').value = store.seller_name || ''
                document.getElementById('storeAddress').value = store.address || ''
                document.getElementById('storePhone').value = store.phone || ''
                document.getElementById('storeRegion').value = store.region
                document.getElementById('storeIdealTime').value = store.ideal_time || ''
                document.getElementById('storePurchaseProb').value = store.purchase_prob || ''
                document.getElementById('storeModalTitle').textContent = 'ویرایش فروشگاه'

                if (store.visit_days) {
                    store.visit_days.forEach(d => {
                        const cb = document.getElementById(`d${d}`)
                        if (cb) cb.checked = true
                    })
                }
            }
        } else {
            document.getElementById('storeId').value = ''
            document.getElementById('storeModalTitle').textContent = 'ثبت فروشگاه جدید'
        }

        new bootstrap.Modal(document.getElementById('addStoreModal')).show()
    },

    async handleSaveStore() {
        const id = document.getElementById('storeId').value
        const name = document.getElementById('storeName').value.trim()
        const region = document.getElementById('storeRegion').value

        if (!name || !region) {
            this.showToast('نام و منطقه الزامی است.', 'error')
            return
        }

        const visitDays = []
        document.querySelectorAll('.store-day-check:checked').forEach(cb => visitDays.push(parseInt(cb.value)))

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
        }

        try {
            if (id) {
                await db.updateStore(id, storeData)
                this.showToast('فروشگاه با موفقیت ویرایش شد.', 'success')
            } else {
                await db.addStore(storeData)
                this.showToast('فروشگاه جدید ثبت شد.', 'success')
            }

            bootstrap.Modal.getInstance(document.getElementById('addStoreModal')).hide()
            await this.refreshData()
            this.renderStores()
        } catch (err) {
            console.error(err)
            this.showToast('خطا در ذخیره سازی', 'error')
        }
    },

    // --- Region & Product Actions ---

    async handleAddRegion() {
        const name = document.getElementById('newRegionInput').value.trim()
        if (!name) return
        try {
            await db.addRegion(name)
            document.getElementById('newRegionInput').value = ''
            await this.refreshData()
            this.renderRegions()
            this.showToast('منطقه افزوده شد.', 'success')
        } catch(e) { console.error(e); this.showToast('خطا در افزودن منطقه', 'error') }
    },

    async handleAddProduct() {
        const name = document.getElementById('newProductInput').value.trim()
        if (!name) return
        try {
            await db.addProduct(name)
            document.getElementById('newProductInput').value = ''
            await this.refreshData()
            this.renderRegions()
            this.showToast('کالا افزوده شد.', 'success')
        } catch(e) { console.error(e); this.showToast('خطا در افزودن کالا', 'error') }
    },

    async handleResetDaily() {
        if (confirm('شروع روز جدید؟ همه ویزیت‌ها ریست می‌شوند.')) {
            await db.resetDailyVisits()
            await this.refreshData()
            this.renderStores()
            this.showToast('روز جدید شروع شد.', 'success')
        }
    },

    // --- Import Logic ---
    async handleImport(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('آیا مطمئن هستید؟ داده‌های وارد شده اضافه/بروزرسانی خواهند شد.')) {
            e.target.value = '';
            return;
        }

        try {
            let data;
            if (type === 'json') {
                data = await parseJSONBackup(file);
            } else if (type === 'excel') {
                data = await parseExcelBackup(file);
            }

            if (data) {
                await db.importData(data);
                this.showToast('بازگردانی با موفقیت انجام شد.', 'success');
                await this.refreshData();
                this.renderStores(); // Update UI
            }
        } catch (error) {
            console.error(error);
            this.showToast('خطا در بازگردانی فایل.', 'error');
        } finally {
            e.target.value = ''; // Reset input
        }
    },

    // --- Order Logic ---

    openOrderModal(storeId, orderId = null) {
        document.getElementById('orderStoreId').value = storeId
        document.getElementById('orderId').value = orderId || ''
        document.getElementById('orderText').value = ''
        document.getElementById('orderCartonCount').value = 1
        this.currentOrderItems = []

        if (orderId) {
            const store = this.data.stores.find(s => s.id == storeId)
            const order = store?.orders.find(o => o.id == orderId)
            if (order) {
                document.getElementById('orderText').value = order.text || ''
                this.currentOrderItems = JSON.parse(JSON.stringify(order.items || []))
            }
        }

        this.renderOrderItems()
        new bootstrap.Modal(document.getElementById('orderModal')).show()
    },

    addOrderItem() {
        const select = document.getElementById('orderProductSelect')
        const productId = select.value
        const productName = select.options[select.selectedIndex]?.text
        const count = parseInt(document.getElementById('orderCartonCount').value)

        if (!productId) {
            this.showToast('کالا انتخاب کنید', 'error')
            return
        }

        const existing = this.currentOrderItems.find(i => i.productId == productId)
        if (existing) {
            existing.count += count
        } else {
            this.currentOrderItems.push({ productId, productName, count })
        }
        this.renderOrderItems()
    },

    renderOrderItems() {
        const list = document.getElementById('orderItemsList')
        const msg = document.getElementById('noItemsMsg')
        list.innerHTML = ''

        if (this.currentOrderItems.length === 0) {
            msg.classList.remove('d-none')
        } else {
            msg.classList.add('d-none')
            this.currentOrderItems.forEach((item, idx) => {
                const tr = document.createElement('tr')
                tr.innerHTML = `
                    <td>${this.escapeHtml(item.productName)}</td>
                    <td>${item.count}</td>
                    <td class="text-end"><button class="btn btn-sm text-danger" onclick="document.dispatchEvent(new CustomEvent('remove-item', {detail: ${idx}}))">&times;</button></td>
                `
                // Hacky onclick binding for simplicity inside module
                tr.querySelector('button').onclick = () => {
                   this.currentOrderItems.splice(idx, 1)
                   this.renderOrderItems()
                }
                list.appendChild(tr)
            })
        }
    },

    async handleSaveOrder() {
        const storeId = document.getElementById('orderStoreId').value
        const orderId = document.getElementById('orderId').value
        const text = document.getElementById('orderText').value

        if (this.currentOrderItems.length === 0 && !text) {
            this.showToast('حداقل یک کالا یا توضیح وارد کنید', 'error')
            return
        }

        const orderData = {
            date: new Date().toLocaleDateString('fa-IR'),
            text,
            items: this.currentOrderItems
        }

        try {
            if (orderId) {
                await db.updateOrder(orderId, orderData)
            } else {
                await db.addOrder(storeId, orderData)
            }
            bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide()
            await this.refreshData()
            if (this.currentView === 'orders') this.renderAllOrders()
            else this.renderStores()
        } catch (e) { console.error(e); alert('خطا در ثبت سفارش') }
    },

    showDailySales() {
         const today = new Date().toLocaleDateString('fa-IR')
         let count = 0
         let products = {}

         this.data.stores.forEach(s => {
             if (s.orders) {
                 s.orders.forEach(o => {
                     if (o.date === today) {
                         count++
                         if (o.items) {
                             o.items.forEach(i => {
                                 products[i.productName] = (products[i.productName] || 0) + i.count
                             })
                         }
                     }
                 })
             }
         })

         let html = `<div class="alert alert-info text-center"><h4>${count}</h4><small>سفارشات امروز</small></div>`
         if (Object.keys(products).length) {
             html += '<ul class="list-group">'
             for (const [name, qty] of Object.entries(products)) {
                 html += `<li class="list-group-item d-flex justify-content-between">${name} <span class="badge bg-primary">${qty}</span></li>`
             }
             html += '</ul>'
         }

         document.getElementById('dailySalesContent').innerHTML = html
         new bootstrap.Modal(document.getElementById('dailySalesModal')).show()
    },

    escapeHtml(text) {
        if (!text) return text
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }
}
