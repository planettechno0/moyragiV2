import { Utils } from '../shared/Utils.js';

export const StoreCard = {
    create(store, isVisited) {
        const { escapeHtml, daysMap, idealTimeMap } = Utils;
        const currentDayIndex = new Date().getDay();
        const todayStr = new Date().toISOString().slice(0, 10);

        // Check if recently visited by phone (e.g. today)
        let isPhoneVisited = false;
        // Check if recently visited physically (e.g. within 7 days or today specific check if needed)
        // Note: isVisited parameter passed to create() is based on `store.last_visit` window.
        // We should refine it to exclude phone visits if we want separate states.
        // If `store.last_visit` is today, and `store.visit_logs` has a phone log today,
        // does `last_visit` represent the phone visit? Yes.
        // So `isVisited` (7 days) might be true because of a phone visit.
        // We want the physical toggle to be ON only if there is a PHYSICAL visit (or untyped).

        let isPhysicalVisited = false;

        if (store.visit_logs && store.visit_logs.length > 0) {
            // Check for phone visit today
            const phoneLog = store.visit_logs.find(l =>
                l.visited_at.startsWith(todayStr) && l.visit_type === 'phone'
            );
            if (phoneLog) isPhoneVisited = true;

            // Check for physical visit within 7 days
            // We use the same 7-day logic as the filter/main logic but filter by type
            const now = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // Find any log that is 'physical' (or null/undefined for legacy) and recent
            const physicalLog = store.visit_logs.find(l => {
                const logDate = new Date(l.visited_at);
                const isRecent = logDate >= sevenDaysAgo && logDate <= now; // Approximate
                // Check type
                const isPhysical = !l.visit_type || l.visit_type === 'physical';
                return isRecent && isPhysical;
            });

            if (physicalLog) isPhysicalVisited = true;
        } else {
            // Fallback if no logs (legacy data or just `last_visit` field present)
            // If `isVisited` (based on last_visit) is true, and we have NO logs, assume physical.
            if (isVisited) isPhysicalVisited = true;
        }

        // Day Badge Logic
        let dayBadge = '';
        if (store.visit_days && store.visit_days.length > 0) {
            const today = store.visit_days.find(d => d === currentDayIndex);
            const dayToShow = today !== undefined ? today : store.visit_days[0];
            dayBadge = `<div class="d-flex align-items-center"><i class="bi bi-calendar-event text-secondary me-1 small"></i><span class="text-primary fw-bold small">${daysMap[dayToShow]}</span></div>`;
        }

        // Other Badges
        let otherBadges = '';
        if (store.ideal_time) {
            otherBadges += `<span class="badge bg-info-subtle text-dark me-1 border"><i class="bi bi-clock"></i> ${idealTimeMap[store.ideal_time]}</span>`;
        }
        if (store.purchase_prob) {
            const probText = store.purchase_prob === 'high' ? 'احتمال خرید: زیاد' : 'احتمال خرید: کم';
            const probClass = store.purchase_prob === 'high' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-dark';
            otherBadges += `<span class="badge ${probClass} me-1 border"><i class="bi bi-graph-up"></i> ${probText}</span>`;
        }

        const cardContainer = document.createElement('div');
        cardContainer.className = 'col-md-6 col-lg-4';

        // Use updated isPhysicalVisited
        cardContainer.innerHTML = `
            <div class="card h-100 store-card ${isPhysicalVisited ? 'visited' : ''}">
                <div class="card-body p-2 d-flex flex-column">
                    <!-- Header -->
                    <div class="d-flex justify-content-between align-items-start mb-2 fixed-height-header">
                        <div class="d-flex flex-column align-items-start">
                            <h5 class="card-title fw-bold mb-1 text-dark" style="font-size: 1.1rem;">${escapeHtml(store.name)}</h5>
                            <button class="btn btn-link p-0 text-decoration-none text-muted small" data-action="edit-store" data-store-id="${store.id}">
                                 ${escapeHtml(store.region)} <i class="bi bi-pencil-fill small ms-1" style="font-size: 0.7em;"></i>
                            </button>
                        </div>
                        <div class="text-center d-flex flex-column gap-1 align-items-end">
                             <!-- Physical Visit -->
                             <div class="form-check form-switch d-inline-block" title="ویزیت حضوری">
                                 <input class="form-check-input" type="checkbox" ${isPhysicalVisited ? 'checked' : ''} data-action="toggle-visit" data-store-id="${store.id}" style="width: 2.5em; height: 1.25em;">
                             </div>
                             <!-- Phone Visit -->
                             <div class="form-check form-switch d-inline-block" title="ویزیت تلفنی">
                                 <input class="form-check-input phone-visit-toggle" type="checkbox" ${isPhoneVisited ? 'checked' : ''} data-action="toggle-phone-visit" data-store-id="${store.id}" style="width: 2.5em; height: 1.25em;">
                             </div>
                        </div>
                    </div>

                    <!-- Info Box -->
                    <div class="store-info-box bg-light rounded-3 p-2 mb-2 fixed-height-info">
                         <!-- Address -->
                         <div class="d-flex justify-content-end align-items-center mb-1 text-end">
                             <span class="text-secondary small text-truncate" style="max-width: 90%; font-size: 0.8rem;">${escapeHtml(store.address) || 'بدون آدرس'}</span>
                             <i class="bi bi-geo-alt-fill text-secondary ms-1 small"></i>
                         </div>
                         <hr class="my-1 border-secondary opacity-10">
                         <!-- Row 2: Phone | Seller -->
                         <div class="d-flex justify-content-between align-items-center mb-1">
                             <!-- Phone (Left) -->
                             <div class="d-flex align-items-center">
                                 <i class="bi bi-telephone-fill text-secondary me-1 small"></i>
                                 <a href="tel:${escapeHtml(store.phone)}" class="text-decoration-none text-dark fw-bold" style="font-size: 0.8rem;" dir="ltr">${escapeHtml(store.phone) || '-'}</a>
                             </div>
                             <div class="vr text-secondary opacity-25" style="height: 15px;"></div>
                             <!-- Seller (Right) -->
                             <div class="d-flex align-items-center">
                                 <span class="fw-bold text-dark" style="font-size: 0.8rem;">${escapeHtml(store.seller_name) || '-'}</span>
                                 <i class="bi bi-person-fill text-secondary ms-1 small"></i>
                             </div>
                         </div>
                         ${dayBadge ? `
                         <hr class="my-1 border-secondary opacity-10">
                         <!-- Row 3: Day Badge -->
                         <div class="d-flex justify-content-center align-items-center">
                             ${dayBadge}
                         </div>` : ''}
                    </div>

                    <!-- Other Badges -->
                    <div class="mb-2 text-end fixed-height-badges">
                        ${otherBadges}
                    </div>

                    <!-- Actions -->
                    <div class="d-flex gap-2 mt-auto">
                        <button class="btn btn-outline-info btn-action-secondary flex-grow-1 d-flex align-items-center justify-content-center" data-action="show-details" data-store-id="${store.id}" title="جزئیات بیشتر">
                            <i class="bi bi-info-circle fs-5"></i>
                        </button>
                         <button class="btn btn-outline-secondary btn-action-secondary flex-grow-1 d-flex align-items-center justify-content-center" data-action="new-visit" data-store-id="${store.id}" title="قرار قبلی">
                            <i class="bi bi-calendar4 fs-5"></i>
                        </button>
                        <button class="btn btn-primary btn-action-primary flex-grow-1 d-flex align-items-center justify-content-center" data-action="new-order" data-store-id="${store.id}" title="ثبت سفارش">
                            <i class="bi bi-cart-plus fs-5"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        return cardContainer;
    }
};
