const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';

// Lazy load helper
let xlsxModule = null;
async function loadXLSX() {
    if (xlsxModule) return xlsxModule;
    try {
        xlsxModule = await import(XLSX_URL);
        return xlsxModule;
    } catch (e) {
        console.error('Failed to load XLSX library:', e);
        throw new Error('خطا در بارگذاری کتابخانه اکسل. اینترنت خود را بررسی کنید.');
    }
}

export const exportToExcel = async (stores) => {
    const XLSX = await loadXLSX();

    // Flatten data for export
    const rows = [];

    stores.forEach(store => {
        // Basic Store Info
        const storeBase = {
            'شناسه فروشگاه': store.id,
            'نام فروشگاه': store.name,
            'نام فروشنده': store.seller_name,
            'آدرس': store.address,
            'تلفن': store.phone,
            'منطقه': store.region,
            'زمان ایده‌آل': store.ideal_time,
            'احتمال خرید': store.purchase_prob,
            'توضیحات': store.description,
            'ویزیت شده': store.visited ? 'بله' : 'خیر'
        };

        if (store.orders && store.orders.length > 0) {
            store.orders.forEach(order => {
                let itemsStr = '';
                if (order.items && Array.isArray(order.items)) {
                    itemsStr = order.items.map(i => `${i.productName} (${i.count})`).join(', ');
                }

                rows.push({
                    ...storeBase,
                    'تاریخ سفارش': order.date,
                    'اقلام سفارش': itemsStr,
                    'توضیحات سفارش': order.text,
                    'شناسه سفارش': order.id
                });
            });
        } else {
            // Store with no orders
            rows.push({
                ...storeBase,
                'تاریخ سفارش': '-',
                'اقلام سفارش': '-',
                'توضیحات سفارش': '-',
                'شناسه سفارش': '-'
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");

    // Auto-width columns (simple estimation)
    const maxWidth = 50;
    const colWidths = Object.keys(rows[0] || {}).map(key => ({ wch: 20 }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `Moyragi_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// --- Full Backup & Restore ---

export const backupToExcel = async (data) => {
    const XLSX = await loadXLSX();
    const workbook = XLSX.utils.book_new();

    // 1. Regions
    if (data.regions && data.regions.length) {
        const wsRegions = XLSX.utils.json_to_sheet(data.regions);
        XLSX.utils.book_append_sheet(workbook, wsRegions, "Regions");
    }

    // 2. Products
    if (data.products && data.products.length) {
        const wsProducts = XLSX.utils.json_to_sheet(data.products);
        XLSX.utils.book_append_sheet(workbook, wsProducts, "Products");
    }

    // 3. Stores
    if (data.stores && data.stores.length) {
        // We need to strip 'orders' from stores for the sheet, or keep it flat.
        // For backup/restore DB style, strict separation is better.
        const storesClean = data.stores.map(s => {
            const { orders, ...rest } = s; // Exclude orders array from store sheet
            // Convert array visit_days to string for CSV/Excel safety if needed, but XLSX handles arrays okay usually?
            // Actually, for restore, simpler to JSON stringify arrays or keep as is if library supports it.
            // Let's JSON stringify visit_days to be safe.
            return {
                ...rest,
                visit_days: JSON.stringify(rest.visit_days)
            };
        });
        const wsStores = XLSX.utils.json_to_sheet(storesClean);
        XLSX.utils.book_append_sheet(workbook, wsStores, "Stores");
    }

    // 4. Orders
    // Extract all orders
    let allOrders = [];
    if (data.stores) {
        data.stores.forEach(store => {
            if (store.orders) {
                store.orders.forEach(order => {
                    // Flatten items to JSON string
                    allOrders.push({
                        ...order,
                        items: JSON.stringify(order.items)
                    });
                });
            }
        });
    }
    if (allOrders.length) {
        const wsOrders = XLSX.utils.json_to_sheet(allOrders);
        XLSX.utils.book_append_sheet(workbook, wsOrders, "Orders");
    }

    // 5. Visits
    if (data.visits && data.visits.length) {
        const cleanVisits = data.visits.map(v => {
            const { store, ...rest } = v; // Remove nested store object
            return rest;
        });
        const wsVisits = XLSX.utils.json_to_sheet(cleanVisits);
        XLSX.utils.book_append_sheet(workbook, wsVisits, "Visits");
    }

    XLSX.writeFile(workbook, `Moyragi_Backup_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const parseExcelBackup = (file) => {
    return new Promise(async (resolve, reject) => {
        // Note: FileReader onload is sync but we need async await.
        // Better to load lib first before reading file.
        let XLSX;
        try {
            XLSX = await loadXLSX();
        } catch (err) {
            reject(err);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const result = {
                    regions: [],
                    products: [],
                    stores: [],
                    orders: []
                };

                // Regions
                if (workbook.Sheets["Regions"]) {
                    result.regions = XLSX.utils.sheet_to_json(workbook.Sheets["Regions"]);
                }

                // Products
                if (workbook.Sheets["Products"]) {
                    result.products = XLSX.utils.sheet_to_json(workbook.Sheets["Products"]);
                }

                // Stores
                if (workbook.Sheets["Stores"]) {
                    const rawStores = XLSX.utils.sheet_to_json(workbook.Sheets["Stores"]);
                    result.stores = rawStores.map(s => ({
                        ...s,
                        visit_days: s.visit_days ? JSON.parse(s.visit_days) : []
                    }));
                }

                // Orders
                if (workbook.Sheets["Orders"]) {
                    const rawOrders = XLSX.utils.sheet_to_json(workbook.Sheets["Orders"]);
                    result.orders = rawOrders.map(o => ({
                        ...o,
                        items: o.items ? JSON.parse(o.items) : []
                    }));
                }

                // Visits
                if (workbook.Sheets["Visits"]) {
                    result.visits = XLSX.utils.sheet_to_json(workbook.Sheets["Visits"]);
                }

                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
};
