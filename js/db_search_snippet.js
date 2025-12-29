    async searchStores(query) {
        // Ensure query is safe and basic cleaning
        const q = query.trim();
        if (!q) return [];

        // Search in multiple columns using ILIKE
        // Note: Supabase 'or' syntax: col.ilike.%val%,col2.ilike.%val%
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
            .limit(100); // Limit search results to 100 for now

        if (error) throw error

        // Sort nested as usual
        if (data) {
             data.forEach(store => {
                 if (store.visit_logs) store.visit_logs.sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at))
                 if (store.orders) store.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
             })
        }
        return data;
    },
