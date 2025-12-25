import * as XLSX from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';

export const exportToExcel = (stores) => {
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
