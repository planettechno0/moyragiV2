import { db } from '../../services/db.js';
import { dateUtils } from '../../services/date_utils.js';
import { state } from '../../core/state.js';
import { Toast } from '../shared/Toast.js';
import { VisitList } from './VisitList.js';
import { Utils } from '../shared/Utils.js';

export const VisitModal = {
    open(storeId) {
        document.getElementById('visitStoreId').value = storeId;
        document.getElementById('visitDate').value = dateUtils.getTodayJalaali();
        document.getElementById('visitTime').value = '';
        document.getElementById('visitNote').value = '';
        new bootstrap.Modal(document.getElementById('visitModal')).show();
    },

    async save() {
        if (typeof window.jalaali === 'undefined') {
             Toast.show('سیستم تاریخ بارگزاری نشده است. لطفاً صفحه را رفرش کنید.', 'error');
             return;
        }

        const btn = document.getElementById('saveVisitBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ثبت...';

        const storeId = document.getElementById('visitStoreId').value;
        const date = document.getElementById('visitDate').value.trim();
        const time = document.getElementById('visitTime').value;
        const note = document.getElementById('visitNote').value;

        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
            Toast.show('فرمت تاریخ باید 1402/01/01 باشد', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }

        try {
            await db.addVisit({
                storeId,
                visitDate: date,
                visitTime: time,
                note
            });
            Toast.show('قرار ویزیت ثبت شد', 'success');
            bootstrap.Modal.getInstance(document.getElementById('visitModal')).hide();

            // Reload visits from DB directly to update list
            await VisitList.render();

        } catch (e) {
            console.error(e);
            if ((e.message && e.message.includes('relation "visits" does not exist')) ||
                (e.code === 'PGRST205' || e.message.includes('Could not find the table'))) {
                 Toast.show('جدول ویزیت‌ها یافت نشد. لطفاً اسکریپت دیتابیس را از تنظیمات دریافت و اجرا کنید.', 'error');
            } else {
                 Toast.show('خطا در ثبت قرار. اتصال اینترنت را بررسی کنید.', 'error');
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    openEditLog(storeId, logId) {
        const store = state.data.stores.find(s => s.id == storeId);
        const log = store?.visit_logs?.find(l => l.id == logId);
        if (!log) return;

        document.getElementById('editLogId').value = logId;
        document.getElementById('editLogStoreId').value = storeId;

        const dateObj = new Date(log.visited_at);
        document.getElementById('editLogDate').value = dateUtils.toJalaali(dateObj);
        document.getElementById('editLogTime').value = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('editLogNote').value = log.note || '';

        new bootstrap.Modal(document.getElementById('editLogModal')).show();
    },

    async saveLogEdit() {
        const btn = document.getElementById('saveLogEditBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'ذخیره...';

        const logId = document.getElementById('editLogId').value;
        const storeId = document.getElementById('editLogStoreId').value;
        const dateStr = document.getElementById('editLogDate').value;
        const timeStr = document.getElementById('editLogTime').value;
        const note = document.getElementById('editLogNote').value;

        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
            Toast.show('فرمت تاریخ باید 1402/01/01 باشد', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }

        try {
            if (typeof jalaali === 'undefined') throw new Error('Jalaali lib missing');

            const [jy, jm, jd] = dateStr.split('/').map(Number);
            const g = jalaali.toGregorian(jy, jm, jd);
            const d = new Date(g.gy, g.gm - 1, g.gd);

            if (timeStr) {
                const [hh, mm] = timeStr.split(':').map(Number);
                d.setHours(hh, mm);
            }

            const isoDate = d.toISOString();

            await db.updateVisitLog(logId, note, isoDate);

            // Update local state for immediate UI feedback
            const store = state.data.stores.find(s => s.id == storeId);
            if (store && store.visit_logs) {
                const log = store.visit_logs.find(l => l.id == logId);
                if (log) {
                    log.visited_at = isoDate;
                    log.note = note;
                }
            }

            bootstrap.Modal.getInstance(document.getElementById('editLogModal')).hide();
            document.dispatchEvent(new CustomEvent('visit-log-updated', { detail: { storeId } }));

            Toast.show('ویرایش شد', 'success');

        } catch (e) {
            console.error(e);
            Toast.show('خطا در ویرایش', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    async deleteLog(storeId, logId) {
         if (confirm('آیا از حذف این سابقه ویزیت اطمینان دارید؟')) {
             await db.deleteVisitLog(logId);
             const store = state.data.stores.find(s => s.id == storeId);
             if (store && store.visit_logs) {
                 store.visit_logs = store.visit_logs.filter(l => l.id != logId);
             }
             document.dispatchEvent(new CustomEvent('visit-log-updated', { detail: { storeId } }));
             Toast.show('حذف شد', 'success');
         }
    },

    // Safeguard against multiple listener attachments
    listenersAttached: false,

    initListeners() {
        if (this.listenersAttached) return;

        document.getElementById('saveVisitBtn').addEventListener('click', () => this.save());
        document.getElementById('saveLogEditBtn').addEventListener('click', () => this.saveLogEdit());

        this.listenersAttached = true;
    }
};
