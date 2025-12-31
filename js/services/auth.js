import { supabase } from './supabase.js'

export const auth = {
    user: null,

    async init() {
        // Check active session
        try {
            const { data, error } = await supabase.auth.getSession()
            if (error) console.error("Auth init error:", error)
            this.user = data?.session?.user || null
        } catch (e) {
            console.error("Auth init failed:", e)
        }

        // Listen for changes
        supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user || null
            this.updateUI()
        })

        // Ensure UI matches initial state immediately
        this.updateUI()
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        if (error) throw error
        return data
    },

    async logout() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    },

    updateUI() {
        const authContainer = document.getElementById('authContainer')
        const appContainer = document.getElementById('appContainer')

        // Safety check if elements exist (e.g. running in test mode)
        if (!authContainer || !appContainer) return;

        if (this.user) {
            authContainer.classList.add('d-none')
            appContainer.classList.remove('d-none')
        } else {
            authContainer.classList.remove('d-none')
            appContainer.classList.add('d-none')
        }
    }
}
