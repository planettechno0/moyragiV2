import { auth } from './auth.js'
import { ui } from './ui.js'

document.addEventListener('DOMContentLoaded', async () => {

    // Auth Event Listeners
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault()
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const btn = document.getElementById('loginBtn')
        const loading = document.getElementById('loginLoading')
        const errorMsg = document.getElementById('loginError')

        btn.disabled = true
        loading.classList.remove('d-none')
        errorMsg.textContent = ''

        try {
            await auth.login(email, password)
            // UI update handled by auth listener
        } catch (error) {
            console.error(error)
            errorMsg.textContent = 'ورود ناموفق. لطفاً ایمیل و رمز عبور را بررسی کنید.'
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

    // Safety Check: Fix "Dark Screen" issues caused by lingering modals or hidden containers
    setTimeout(() => {
        // 1. Remove stuck modal backdrops
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = ''; // Reset scroll if locked

        // 2. Ensure a container is visible
        const appContainer = document.getElementById('appContainer');
        const authContainer = document.getElementById('authContainer');

        if (appContainer.classList.contains('d-none') && authContainer.classList.contains('d-none')) {
            console.warn('Safety Check: No container visible. Forcing visibility.');
            if (auth.user) {
                appContainer.classList.remove('d-none');
            } else {
                authContainer.classList.remove('d-none');
            }
        }
    }, 1000); // 1 second delay to allow normal init to finish
})
