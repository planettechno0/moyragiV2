import { auth } from './auth.js'
import { ui } from './ui.js'

document.addEventListener('DOMContentLoaded', async () => {
    let isLoginMode = true;

    // Toggle Auth Mode
    document.getElementById('toggleAuthMode').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;

        const title = document.getElementById('authTitle');
        const btnText = document.getElementById('loginBtnText');
        const toggleLink = document.getElementById('toggleAuthMode');
        const errorMsg = document.getElementById('loginError');
        const successMsg = document.getElementById('loginSuccess');

        errorMsg.textContent = '';
        successMsg.textContent = '';

        if (isLoginMode) {
            title.textContent = 'ورود به سامانه';
            btnText.textContent = 'ورود';
            toggleLink.textContent = 'حساب کاربری ندارید؟ ثبت نام';
        } else {
            title.textContent = 'ثبت نام در سامانه';
            btnText.textContent = 'ثبت نام';
            toggleLink.textContent = 'قبلا ثبت نام کرده‌اید؟ ورود';
        }
    });

    // Auth Event Listeners
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault()
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const btn = document.getElementById('loginBtn')
        const loading = document.getElementById('loginLoading')
        const errorMsg = document.getElementById('loginError')
        const successMsg = document.getElementById('loginSuccess')

        btn.disabled = true
        loading.classList.remove('d-none')
        errorMsg.textContent = ''
        successMsg.textContent = ''

        try {
            if (isLoginMode) {
                await auth.login(email, password)
                // UI update handled by auth listener
            } else {
                await auth.signup(email, password)
                successMsg.textContent = 'ثبت نام موفقیت‌آمیز بود. لطفاً برای تایید ایمیل خود را چک کنید (یا وارد شوید).'
                // Ideally, auto-login or switch back to login mode?
                // Supabase typically auto-logs in if email confirmation is disabled,
                // or requires confirmation. We'll show message.

                // If Supabase is set to auto-confirm (dev mode), auth listener will catch session change.
            }
        } catch (error) {
            console.error(error)
            errorMsg.textContent = isLoginMode
                ? 'ورود ناموفق. لطفاً ایمیل و رمز عبور را بررسی کنید.'
                : 'ثبت نام ناموفق. لطفاً دوباره تلاش کنید.'
        } finally {
            btn.disabled = false
            loading.classList.add('d-none')
        }
    })

    // Click delegation for UI interactions (passed to ui module)
    document.body.addEventListener('click', (e) => ui.handleGlobalClick(e))
    document.body.addEventListener('change', (e) => ui.handleGlobalClick(e)) // For checkboxes

    // Initialize Auth
    await auth.init()

    // Initialize UI if logged in
    if (auth.user) {
        await ui.init()
    }

    // Re-init UI on auth state change to logged in
    // Note: auth.init() sets up a listener that toggles visibility.
    // We also need to fetch data when switching to logged in state.
    const originalUpdateUI = auth.updateUI.bind(auth)
    auth.updateUI = () => {
        originalUpdateUI()
        if (auth.user) {
            ui.init()
        }
    }
})
