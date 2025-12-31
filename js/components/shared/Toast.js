export const Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const id = 'toast-' + Date.now();
        const colorClass = type === 'error' ? 'text-bg-danger' :
                           type === 'success' ? 'text-bg-success' : 'text-bg-primary';

        const toastHtml = `
            <div id="${id}" class="toast align-items-center ${colorClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHtml);

        const toastEl = document.getElementById(id);
        // Assuming bootstrap is available globally
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();

        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    }
};
