import { supabase } from './supabase.js'

export const db = {
    // --- Regions ---
    async getRegions() {
        const { data, error } = await supabase.from('regions').select('*').order('created_at', { ascending: true })
        if (error) throw error
        return data
    },

    async fetchAll(table, queryModifier = null) {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            let query = supabase.from(table).select('*').range(from, to);

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
        const modifier = (query) => query.select('*, orders (*)').order('created_at', { ascending: false });
        const data = await this.fetchAll('stores', modifier);

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
        const [regions, products, stores, orders, visits, visit_logs] = await Promise.all([
            this.fetchAll('regions'),
            this.fetchAll('products'),
            this.getAllStores(),
            this.fetchAll('orders'),
            this.fetchAll('visits'),
            this.fetchAll('visit_logs')
        ]);

        return {
            regions,
            products,
            stores,
            orders,
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
    async getStores(page = 0, pageSize = 20, filters = {}) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('stores')
            .select(`
                *,
                orders (*),
                visit_logs (*)
            `)
            .order('created_at', { ascending: false })
            .range(from, to);

        // Server-Side Filters
        if (filters.region && filters.region !== 'all') {
            query = query.eq('region', filters.region);
        }

        if (filters.purchaseProb && filters.purchaseProb !== 'all') {
            query = query.eq('purchase_prob', filters.purchaseProb);
        }

        if (filters.day !== undefined && filters.day !== 'all') {
            let dayInt = parseInt(filters.day);
            if (filters.day === 'today') {
                dayInt = new Date().getDay();
            }
            if (!isNaN(dayInt)) {
                query = query.contains('visit_days', [dayInt]);
            }
        }

        if (filters.visitStatus && filters.visitStatus !== 'all') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const isoDate = sevenDaysAgo.toISOString();

            if (filters.visitStatus === 'visited') {
                query = query.gte('last_visit', isoDate);
            } else if (filters.visitStatus === 'not_visited') {
                query = query.or(`last_visit.lt.${isoDate},last_visit.is.null`);
            }
        }

        const { data, error } = await query;

        if (error) throw error

        if (data) {
             data.forEach(store => {
                 if (store.visit_logs) {
                     store.visit_logs.sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at))
                 }
             })
        }

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
        const { error } = await supabase.from('stores').delete().eq('id', id)
        if (error) throw error
    },

    async searchStores(query) {
        const q = query.trim();
        if (!q) return [];

        const searchPattern = `name.ilike.%${q}%,address.ilike.%${q}%,phone.ilike.%${q}%,seller_name.ilike.%${q}%`;

        const { data, error } = await supabase
            .from('stores')
            .select(`
                *,
                orders (*),
                visit_logs (*)
            `)
            .or(searchPattern)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error

        if (data) {
             data.forEach(store => {
                 if (store.visit_logs) store.visit_logs.sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at))
                 if (store.orders) store.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
             })
        }
        return data;
    },

    async logVisit(storeId, visitType = 'physical') {
        const now = new Date();
        const nowISO = now.toISOString();

        const { error: storeError } = await supabase
            .from('stores')
            .update({ last_visit: nowISO, visited: true })
            .eq('id', storeId)

        if (storeError) throw storeError

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const { data: existingLogs, error: fetchError } = await supabase
            .from('visit_logs')
            .select('id')
            .eq('store_id', storeId)
            .gte('visited_at', todayStart.toISOString())
            .lte('visited_at', todayEnd.toISOString())
            .limit(1);

        if (fetchError) throw fetchError;

        let resultData = null;

        try {
            if (existingLogs && existingLogs.length > 0) {
                // Update existing
                const log = existingLogs[0];
                const { data, error: updateError } = await supabase
                    .from('visit_logs')
                    .update({ visited_at: nowISO, visit_type: visitType })
                    .eq('id', log.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                resultData = data;
            } else {
                // Insert new
                const { data, error: insertError } = await supabase
                    .from('visit_logs')
                    .insert([{ store_id: storeId, visited_at: nowISO, visit_type: visitType }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                resultData = data;
            }
        } catch (err) {
            // Fallback for missing column 'visit_type'
            if (err.code === '42703' || err.message.includes('visit_type')) {
                // Signal to App that schema is outdated
                document.dispatchEvent(new CustomEvent('db-schema-error'));

                console.warn('DB schema missing visit_type column. Falling back to legacy insert/update.');
                if (existingLogs && existingLogs.length > 0) {
                    const { data, error: fallbackUpdateError } = await supabase
                        .from('visit_logs')
                        .update({ visited_at: nowISO }) // Omit visit_type
                        .eq('id', existingLogs[0].id)
                        .select()
                        .single();
                    if (fallbackUpdateError) throw fallbackUpdateError;
                    resultData = data;
                } else {
                    const { data, error: fallbackInsertError } = await supabase
                        .from('visit_logs')
                        .insert([{ store_id: storeId, visited_at: nowISO }]) // Omit visit_type
                        .select()
                        .single();
                    if (fallbackInsertError) throw fallbackInsertError;
                    resultData = data;
                }

                // Hack: Manually attach visit_type to resultData so UI updates correctly locally
                if (resultData) {
                    resultData.visit_type = visitType;
                }
            } else {
                throw err;
            }
        }

        return resultData;
    },

    async clearVisitLogByType(storeId, type) {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        try {
            const { data: existingLogs } = await supabase
                .from('visit_logs')
                .select('*')
                .eq('store_id', storeId)
                .gte('visited_at', todayStart.toISOString())
                .lte('visited_at', todayEnd.toISOString());

            if (existingLogs) {
                for (const log of existingLogs) {
                    if (log.visit_type === type) {
                        await supabase.from('visit_logs').delete().eq('id', log.id);
                    }
                    else if (type === 'physical' && !log.visit_type) {
                         await supabase.from('visit_logs').delete().eq('id', log.id);
                    }
                }
            }
        } catch (err) {
             console.error('Error clearing visit log:', err);
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
        const { error } = await supabase
            .from('stores')
            .update({ last_visit: null, visited: false })
            .eq('id', storeId)

        if (error) throw error
    },

    async resetDailyVisits() {
        const { error } = await supabase.from('stores').update({ visited: false }).neq('id', 0)
        if (error) throw error
    },

    // ... (rest of the file unchanged)
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

    async getVisits() {
        const { data, error } = await supabase
            .from('visits')
            .select(`
                *,
                store:stores(name, region)
            `)
            .order('visit_date', { ascending: true })

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

    async importData(data) {
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

        if (data.stores && data.stores.length > 0) {
            const storesToInsert = data.stores.map(s => {
                return {
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    seller_name: s.seller_name || s.sellerName,
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

        if (data.orders && data.orders.length > 0) {
             const ordersToInsert = data.orders.map(o => {
                return {
                    id: o.id,
                    store_id: o.store_id || o.storeId,
                    date: o.date,
                    text: o.text,
                    items: o.items
                };
            });
            const { error } = await supabase.from('orders').upsert(ordersToInsert, { onConflict: 'id' });
            if (error) console.error('Error importing orders:', error);
        }

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
