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

    async init() {
        // Load initial data
        await this.refreshData()
        this.renderStores()
        this.renderRegions() // For modals and filters
        this.setupEventListeners()
    },

    async refreshData() {
        try {
            const [stores, regions, products] = await Promise.all([
                db.getStores(),
                db.getRegions(),
                db.getProducts()
            ])
            this.data.stores = stores || []
            this.data.regions = regions || []
            this.data.products = products || []
        } catch (error) {
            console.error('Error loading data:', error)
            alert('خطا در بارگذاری اطلاعات. لطفاً دوباره تلاش کنید.')
        }
    },

    setupEventListeners() {
        // --- Filters ---
        document.getElementById('searchInput').addEventListener('input', () => this.renderStores())
        document.getElementById('filterDay').addEventListener('change', () => this.renderStores())
        document.getElementById('filterRegion').addEventListener('change', () => this.renderStores())
        document.getElementById('filterProb').addEventListener('change', () => this.renderStores())

        // --- Buttons ---
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
        const loading = container.querySelector('.spinner-border')

        // If loading exists and we have data, clear it.
        // Or simple:
        container.innerHTML = ''

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
            emptyState.classList.remove('d-none')
            return
        }
        emptyState.classList.add('d-none')

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
            alert('نام و منطقه الزامی است.')
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
            } else {
                await db.addStore(storeData)
            }

            bootstrap.Modal.getInstance(document.getElementById('addStoreModal')).hide()
            await this.refreshData()
            this.renderStores()
        } catch (err) {
            console.error(err)
            alert('خطا در ذخیره سازی')
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
        } catch(e) { console.error(e); alert('خطا') }
    },

    async handleAddProduct() {
        const name = document.getElementById('newProductInput').value.trim()
        if (!name) return
        try {
            await db.addProduct(name)
            document.getElementById('newProductInput').value = ''
            await this.refreshData()
            this.renderRegions()
        } catch(e) { console.error(e); alert('خطا') }
    },

    async handleResetDaily() {
        if (confirm('شروع روز جدید؟ همه ویزیت‌ها ریست می‌شوند.')) {
            await db.resetDailyVisits()
            await this.refreshData()
            this.renderStores()
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
                alert('بازگردانی با موفقیت انجام شد.');
                await this.refreshData();
                this.renderStores(); // Update UI
            }
        } catch (error) {
            console.error(error);
            alert('خطا در بازگردانی فایل.');
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
            alert('کالا انتخاب کنید')
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
            alert('حداقل یک کالا یا توضیح وارد کنید')
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
