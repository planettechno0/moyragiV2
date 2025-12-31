export const state = {
    data: {
        stores: [],
        regions: [],
        products: [],
        visits: []
    },
    pagination: {
        page: 0,
        pageSize: 10,
        hasMore: true
    },

    // Helper to update specific data key
    update(key, value) {
        if (this.data.hasOwnProperty(key)) {
            this.data[key] = value;
        }
    },

    resetPagination() {
        this.pagination.page = 0;
        this.pagination.hasMore = true;
        this.data.stores = [];
    }
};
