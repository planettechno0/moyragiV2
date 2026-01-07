import { supabase } from './supabase.js'

export const db = {
    // --- Regions ---
    async getRegions() {
        const { data, error } = await supabase.from('regions').select('*').order('created_at', { ascending: true })
        if (error) throw error
        return data
    },

    async getAllStores() {
        // Fetch all stores (used for Management "Load All")
        // Warning: This could be heavy if thousands of records.
        // Supabase limits rows returned (usually 1000).
        // For simplicity, we just ask for a large range or standard select.
        const { data, error } = await supabase
            .from('stores')
            .select(`*, orders (*)`)
            .order('created_at', { ascending: false })
            // Default limit is usually 1000. If more needed, we need loop.
            // Let's assume < 1000 for this user request context or handle basic case.

        if (error) throw error

        // Sort orders
        if (data) {
            data.forEach(store => {
                if (store.orders) {
                    store.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                }
            })
        }
        return data
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
                orders (*)
            `)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error

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

    async toggleVisit(id, visited) {
        const { error } = await supabase.from('stores').update({ visited }).eq('id', id)
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
        if (data.regions && data.regions.length > 0) {
            const { error } = await supabase.from('regions').upsert(data.regions, { onConflict: 'id' });
            if (error) console.error('Error importing regions:', error);
        }

        // 2. Products
        if (data.products && data.products.length > 0) {
            const { error } = await supabase.from('products').upsert(data.products, { onConflict: 'id' });
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
    }
}
