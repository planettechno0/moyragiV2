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

                // Detect Version 2 Schema (Legacy)
                const isLegacyV2 = data.data && (data.data.visitor_stores || data.data.visitor_regions);

                if (isLegacyV2) {
                    const legacyData = data.data;
                    const result = {
                        regions: [],
                        products: [],
                        stores: [],
                        orders: [],
                        visits: [] // Legacy V2 schema doesn't seem to have visits in the provided snippet, but we initialize empty
                    };

                    // Map Regions
                    if (legacyData.visitor_regions && Array.isArray(legacyData.visitor_regions)) {
                        result.regions = legacyData.visitor_regions.map(r => ({ name: r }));
                    }

                    // Map Products
                    if (legacyData.visitor_products && Array.isArray(legacyData.visitor_products)) {
                        result.products = legacyData.visitor_products; // Format matches {id, name}
                    }

                    // Map Stores & Orders
                    if (legacyData.visitor_stores && Array.isArray(legacyData.visitor_stores)) {
                        legacyData.visitor_stores.forEach(store => {
                            const { orders, ...storeProps } = store;

                            // Map camelCase to snake_case explicitly
                            const mappedStore = {
                                id: Math.floor(storeProps.id), // Ensure ID is integer
                                name: storeProps.name,
                                description: storeProps.description,
                                address: storeProps.address,
                                phone: storeProps.phone,
                                region: storeProps.region,
                                visited: storeProps.visited,
                                // Mapped fields
                                seller_name: storeProps.sellerName,
                                ideal_time: storeProps.idealTime,
                                purchase_prob: storeProps.purchaseProb,
                                visit_days: storeProps.visitDays
                            };

                            result.stores.push(mappedStore);

                            if (orders && Array.isArray(orders)) {
                                orders.forEach(order => {
                                    result.orders.push({
                                        id: Math.floor(order.id), // Ensure ID is integer
                                        date: order.date,
                                        text: order.text,
                                        items: order.items,
                                        store_id: Math.floor(store.id) // Ensure ID is integer
                                    });
                                });
                            }
                        });
                    }

                    resolve(result);
                    return;
                }

                // Standard Format Handling
                // Validate basic structure
                if (!data.regions && !data.stores) {
                    throw new Error("Invalid JSON format");
                }

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
