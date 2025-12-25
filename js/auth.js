import { supabase } from './supabase.js'

export const auth = {
    user: null,

    async init() {
        // Check active session
        const { data: { session } } = await supabase.auth.getSession()
        this.user = session?.user || null

        // Listen for changes
        supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user || null
            this.updateUI()
        })
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        if (error) throw error
        return data
    },

    async signup(email, password) {
        const { data, error } = await supabase.auth.signUp({
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

        if (this.user) {
            authContainer.classList.add('d-none')
            appContainer.classList.remove('d-none')
        } else {
            authContainer.classList.remove('d-none')
            appContainer.classList.add('d-none')
        }
    }
}
