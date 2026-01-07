// JSON Backup & Restore Utilities

export const backupToJSON = (data) => {
    // We export the full data object
    const exportData = {
        regions: data.regions || [],
        products: data.products || [],
        stores: data.stores || [], // stores contain nested orders
        visits: data.visits || []
    };

    // In db.js getStores() returns stores with orders nested.
    // If we want a clean relational dump, we could separate them, but JSON handles nesting fine.
    // However, for consistency with Supabase import (which might expect flat tables),
    // let's check if we should flatten.
    // The previous app used nested structure. Let's keep nested for JSON to match user "Old Program" expectation
    // and we will handle the parsing/flattening during import.

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Moyragi_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const parseJSONBackup = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Validate basic structure
                if (!data.regions && !data.stores) {
                    throw new Error("Invalid JSON format");
                }

                // If stores have nested orders (legacy format), we might want to extract them here
                // or let the importer handle it. Ideally the importer expects a standard structure.
                // Let's normalize it to the structure our new Excel importer produces: flat arrays.

                const result = {
                    regions: data.regions || [],
                    products: data.products || [],
                    stores: [],
                    orders: [],
                    visits: data.visits || []
                };

                if (data.stores) {
                    data.stores.forEach(store => {
                        const { orders, ...storeProps } = store;
                        result.stores.push(storeProps);

                        if (orders && Array.isArray(orders)) {
                            orders.forEach(order => {
                                // Ensure order has store_id reference if missing (legacy data might imply it by nesting)
                                result.orders.push({
                                    ...order,
                                    store_id: store.id
                                });
                            });
                        }
                    });
                }

                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};
