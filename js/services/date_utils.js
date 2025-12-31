// Date Utilities using Jalaali.js (window.jalaali)

export const dateUtils = {
    // Convert Gregorian Date object to Jalaali string (YYYY/MM/DD)
    toJalaali(date) {
        if (!date) return '';
        const j = jalaali.toJalaali(date);
        return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
    },

    // Convert Jalaali string (YYYY/MM/DD) to Gregorian Date object
    toGregorian(jDateStr) {
        if (!jDateStr) return null;
        const [y, m, d] = jDateStr.split('/').map(Number);
        const g = jalaali.toGregorian(y, m, d);
        return new Date(g.gy, g.gm - 1, g.gd);
    },

    // Get today's Jalaali date string
    getTodayJalaali() {
        return this.toJalaali(new Date());
    },

    // Get tomorrow's Jalaali date string
    getTomorrowJalaali() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return this.toJalaali(d);
    },

    // Format for display (could be same as toJalaali or with month names)
    formatDisplay(date) {
        return this.toJalaali(date);
    },

    // Check if a date string matches today (Shamsi check)
    isToday(jDateStr) {
        return jDateStr === this.getTodayJalaali();
    },

    // Check if a date string matches tomorrow (Shamsi check)
    isTomorrow(jDateStr) {
        return jDateStr === this.getTomorrowJalaali();
    }
};
