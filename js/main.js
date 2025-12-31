import { auth } from './services/auth.js';
import { App } from './app.js';

document.addEventListener('DOMContentLoaded', async () => {

    // Auth Event Listeners
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('loginBtn');
            const loading = document.getElementById('loginLoading');
            const errorMsg = document.getElementById('loginError');

            if (btn) btn.disabled = true;
            if (loading) loading.classList.remove('d-none');
            if (errorMsg) errorMsg.textContent = '';

            try {
                await auth.login(email, password);
                // UI update handled by auth listener
            } catch (error) {
                console.error(error);
                if (errorMsg) errorMsg.textContent = 'ورود ناموفق. لطفاً ایمیل و رمز عبور را بررسی کنید.';
            } finally {
                if (btn) btn.disabled = false;
                if (loading) loading.classList.add('d-none');
            }
        });
    }

    // Initialize Auth
    await auth.init();

    // Initialize App if logged in
    if (auth.user) {
        await App.init();
    }

    // Hook into Auth UI updates to trigger App Init
    const originalUpdateUI = auth.updateUI.bind(auth);
    auth.updateUI = () => {
        originalUpdateUI();
        if (auth.user) {
            App.init();
        }
    };

    // Safety Check: Fix "Dark Screen"
    setTimeout(() => {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';

        const appContainer = document.getElementById('appContainer');
        const authContainer = document.getElementById('authContainer');

        if (appContainer && authContainer && appContainer.classList.contains('d-none') && authContainer.classList.contains('d-none')) {
            console.warn('Safety Check: No container visible. Forcing visibility.');
            if (auth.user) {
                appContainer.classList.remove('d-none');
            } else {
                authContainer.classList.remove('d-none');
            }
        }
    }, 1000);
});
