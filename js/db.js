import { supabase } from './supabase.js'

export const db = {
    // --- Regions ---
    async getRegions() {
        const { data, error } = await supabase.from('regions').select('*').order('created_at', { ascending: true })
        if (error) throw error
        return data
    },

    async fetchAll(table, queryModifier = null) {
        // Helper to fetch all rows by chunking
        let allData = [];
        let page = 0;
        const pageSize = 1000; // Supabase default limit
        let hasMore = true;

        while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            let query = supabase.from(table).select('*').range(from, to);

            // Allow applying custom modifiers like nested selects or ordering
            if (queryModifier) {
                query = queryModifier(query);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        return allData;
    },

    async getAllStores() {
        // Fetch all stores using chunking to bypass limit
        const modifier = (query) => query.select('*, orders (*)').order('created_at', { ascending: false });
        const data = await this.fetchAll('stores', modifier);

        // Sort orders
        if (data) {
            data.forEach(store => {
                if (store.orders) {
                    store.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                }
            })
        }
        return data;
    },

    async getAllData() {
        // Fetch EVERYTHING for backup
        const [regions, products, stores, orders, visits, visit_logs] = await Promise.all([
            this.fetchAll('regions'),
            this.fetchAll('products'),
            this.fetchAll('stores'), // Note: this fetches stores without nested to be raw for backup?
                                     // Actually backup expects nested structure for current JSON format,
                                     // OR flat structure for strict relational backup.
                                     // Existing 'getAllStores' returns nested.
                                     // Let's fetch flat tables and let backup logic decide,
                                     // OR reuse getAllStores logic if backup expects nesting.
                                     // Backup.js expects: data.stores (with nested?), data.orders (flat?), data.visits.
                                     // Let's look at backup.js: it exports data.stores (which has orders nested).
                                     // BUT it also exports data.orders (flat) if we populate it.
                                     // To be safe and complete, let's fetch 'stores' with 'orders' and 'visit_logs' nested,
                                     // just like 'getStores' but for all.
            // Actually, simply fetching everything flat is safer for a "Full Backup".
            // But 'backupToJSON' logic in 'js/backup.js' dumps 'data.stores'.
            // If we change 'data.stores' to be flat, we break nested expectations.
            // So we should use 'getAllStores' which returns nested.
            this.getAllStores(),
            this.fetchAll('orders'), // Also fetch flat orders just in case
            this.fetchAll('visits'),
            this.fetchAll('visit_logs')
        ]);

        return {
            regions,
            products,
            stores,
            orders, // Redundant if inside stores, but good for completeness
            visits,
            visit_logs
        };
    },

    async addRegion(name) {
        const { data, error } = await supabase.from('regions').insert([{ name }]).select()
        if (error) throw error
        return data[0]
    },

    async deleteRegion(id) {
        const { error } = await supabase.from('regions').delete().eq('id', id)
        if (error) throw error
    },

    // --- Products ---
    async getProducts() {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: true })
        if (error) throw error
        return data
    },

    async addProduct(name) {
        const { data, error } = await supabase.from('products').insert([{ name }]).select()
        if (error) throw error
        return data[0]
    },

    async deleteProduct(id) {
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (error) throw error
    },

    // --- Stores ---
    async getStores(page = 0, pageSize = 20) {
        // Fetch stores with their orders
        // Note: Pagination needs total count for perfect UI, but for Load More, we just need the next batch.
        // Range is inclusive.
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from('stores')
            .select(`
                *,
                orders (*),
                visit_logs (*)
            `)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error

        // Sort visit_logs
        if (data) {
             data.forEach(store => {
                 if (store.visit_logs) {
                     store.visit_logs.sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at))
                 }
             })
        }

        // Sort orders within stores
        if (data) {
            data.forEach(store => {
                if (store.orders) {
                    store.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                }
            })
        }
        return data
    },

    async addStore(storeData) {
        // Prepare data matching DB schema
        const payload = {
            name: storeData.name,
            description: storeData.description,
            seller_name: storeData.sellerName,
            address: storeData.address,
            phone: storeData.phone,
            region: storeData.region,
            ideal_time: storeData.idealTime,
            purchase_prob: storeData.purchaseProb,
            visit_days: storeData.visitDays,
            visited: false
        }

        const { data, error } = await supabase.from('stores').insert([payload]).select()
        if (error) throw error
        return data[0]
    },

    async updateStore(id, storeData) {
         const payload = {
            name: storeData.name,
            description: storeData.description,
            seller_name: storeData.sellerName,
            address: storeData.address,
            phone: storeData.phone,
            region: storeData.region,
            ideal_time: storeData.idealTime,
            purchase_prob: storeData.purchaseProb,
            visit_days: storeData.visitDays,
        }

        const { data, error } = await supabase.from('stores').update(payload).eq('id', id).select()
        if (error) throw error
        return data[0]
    },

    async deleteStore(id) {
        // Cascade delete should handle orders and visits if configured in DB.
        // Assuming DB uses ON DELETE CASCADE.
        const { error } = await supabase.from('stores').delete().eq('id', id)
        if (error) throw error
    },

    async logVisit(storeId) {
        const now = new Date();
        const nowISO = now.toISOString();

        // 1. Update store's last_visit timestamp
        const { error: storeError } = await supabase
            .from('stores')
            .update({ last_visit: nowISO, visited: true })
            .eq('id', storeId)

        if (storeError) throw storeError

        // 2. Insert or Update visit_logs (One per day)
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Check for existing log today
        const { data: existingLogs, error: fetchError } = await supabase
            .from('visit_logs')
            .select('id')
            .eq('store_id', storeId)
            .gte('visited_at', todayStart.toISOString())
            .lte('visited_at', todayEnd.toISOString())
            .limit(1);

        if (fetchError) throw fetchError;

        if (existingLogs && existingLogs.length > 0) {
            // Update existing
            const { error: updateError } = await supabase
                .from('visit_logs')
                .update({ visited_at: nowISO })
                .eq('id', existingLogs[0].id);
            if (updateError) throw updateError;
        } else {
            // Insert new
            const { error: insertError } = await supabase
                .from('visit_logs')
                .insert([{ store_id: storeId, visited_at: nowISO }]);
            if (insertError) throw insertError;
        }
    },

    async updateVisitLog(logId, note, visitedAt) {
         const { error } = await supabase
            .from('visit_logs')
            .update({ note, visited_at: visitedAt })
            .eq('id', logId)
         if (error) throw error
    },

    async deleteVisitLog(logId) {
         const { error } = await supabase
            .from('visit_logs')
            .delete()
            .eq('id', logId)
         if (error) throw error
    },

    async clearVisit(storeId) {
        // Just clear the visual state (last_visit = null)
        const { error } = await supabase
            .from('stores')
            .update({ last_visit: null, visited: false })
            .eq('id', storeId)

        if (error) throw error
    },

    async resetDailyVisits() {
        const { error } = await supabase.from('stores').update({ visited: false }).neq('id', 0) // Update all
        if (error) throw error
    },

    // --- Orders ---
    async addOrder(storeId, orderData) {
        const payload = {
            store_id: storeId,
            date: orderData.date,
            text: orderData.text,
            items: orderData.items
        }
        const { data, error } = await supabase.from('orders').insert([payload]).select()
        if (error) throw error
        return data[0]
    },

    async updateOrder(orderId, orderData) {
        const payload = {
            text: orderData.text,
            items: orderData.items
        }
        const { data, error } = await supabase.from('orders').update(payload).eq('id', orderId).select()
        if (error) throw error
        return data[0]
    },

    async deleteOrder(orderId) {
        const { error } = await supabase.from('orders').delete().eq('id', orderId)
        if (error) throw error
    },

    // --- Visits ---
    async getVisits() {
        const { data, error } = await supabase
            .from('visits')
            .select(`
                *,
                store:stores(name, region)
            `)
            .order('visit_date', { ascending: true }) // Sort by date ascending (closest first)

        if (error) throw error
        return data
    },

    async addVisit(visitData) {
        const payload = {
            store_id: visitData.storeId,
            visit_date: visitData.visitDate,
            visit_time: visitData.visitTime,
            note: visitData.note,
            status: 'pending'
        }
        const { data, error } = await supabase.from('visits').insert([payload]).select()
        if (error) throw error
        return data[0]
    },

    async updateVisitStatus(id, status) {
        const { error } = await supabase.from('visits').update({ status }).eq('id', id)
        if (error) throw error
    },

    async deleteVisit(id) {
        const { error } = await supabase.from('visits').delete().eq('id', id)
        if (error) throw error
    },

    // --- Import / Restore ---

    async importData(data) {
        // Data contains { regions, products, stores, orders }
        // We use 'upsert' to insert or update based on ID.

        // 1. Regions
        // Fix: Deduplicate by name if ID is missing (legacy backup)
        if (data.regions && data.regions.length > 0) {
            const existing = await this.getRegions();
            const regionsToUpsert = data.regions.map(r => {
                const match = existing.find(e => e.name === r.name);
                if (match) {
                    return { ...r, id: match.id };
                }
                return r;
            });
            const { error } = await supabase.from('regions').upsert(regionsToUpsert, { onConflict: 'id' });
            if (error) console.error('Error importing regions:', error);
        }

        // 2. Products
        // Fix: Deduplicate by name if ID is missing
        if (data.products && data.products.length > 0) {
            const existing = await this.getProducts();
            const productsToUpsert = data.products.map(p => {
                const match = existing.find(e => e.name === p.name);
                if (match) {
                    return { ...p, id: match.id };
                }
                return p;
            });
            const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'id' });
            if (error) console.error('Error importing products:', error);
        }

        // 3. Stores
        // We must remove fields that are not columns if any (like 'orders' if not cleaned)
        if (data.stores && data.stores.length > 0) {
            const storesToInsert = data.stores.map(s => {
                // Ensure only valid columns
                return {
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    seller_name: s.seller_name || s.sellerName, // Handle camelCase legacy
                    address: s.address,
                    phone: s.phone,
                    region: s.region,
                    ideal_time: s.ideal_time || s.idealTime,
                    purchase_prob: s.purchase_prob || s.purchaseProb,
                    visit_days: s.visit_days || s.visitDays,
                    visited: !!s.visited
                };
            });
            const { error } = await supabase.from('stores').upsert(storesToInsert, { onConflict: 'id' });
            if (error) console.error('Error importing stores:', error);
        }

        // 4. Orders
        if (data.orders && data.orders.length > 0) {
             const ordersToInsert = data.orders.map(o => {
                return {
                    id: o.id,
                    store_id: o.store_id || o.storeId, // Legacy mapping
                    date: o.date,
                    text: o.text,
                    items: o.items // JSONB
                };
            });
            const { error } = await supabase.from('orders').upsert(ordersToInsert, { onConflict: 'id' });
            if (error) console.error('Error importing orders:', error);
        }

        // 5. Visits
        if (data.visits && data.visits.length > 0) {
            const visitsToInsert = data.visits.map(v => {
                return {
                    id: v.id,
                    store_id: v.store_id || v.storeId,
                    visit_date: v.visit_date || v.visitDate,
                    visit_time: v.visit_time || v.visitTime,
                    note: v.note,
                    status: v.status || 'pending'
                };
            });
            const { error } = await supabase.from('visits').upsert(visitsToInsert, { onConflict: 'id' });
            if (error) console.error('Error importing visits:', error);
        }

        // 6. Visit Logs
        if (data.visit_logs && data.visit_logs.length > 0) {
             const logsToInsert = data.visit_logs.map(l => {
                 return {
                     id: l.id,
                     store_id: l.store_id || l.storeId,
                     visited_at: l.visited_at || l.visitedAt,
                 };
             });
             const { error } = await supabase.from('visit_logs').upsert(logsToInsert, { onConflict: 'id' });
             if (error) console.error('Error importing visit logs:', error);
        }
    }
}
