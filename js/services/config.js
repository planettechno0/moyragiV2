// Supabase Configuration
// In a static file setup without a build step, these must be exposed to the client.
// Ensure your RLS (Row Level Security) policies in Supabase are set correctly to protect data.

const SUPABASE_URL = 'https://shklbyiwpyfxyckmticr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoa2xieWl3cHlmeHlja210aWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODIwODgsImV4cCI6MjA4MjI1ODA4OH0.F-02VDvK97RxpXF0upUy3VM4W6jeIz_i0UCzWbUIPU0';

export const config = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY
};
