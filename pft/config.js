// Supabase Configuration
window.CONFIG = {
  SUPABASE_URL: "https://kmtubcmuitlyjrvotixg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_RLp83gLkdcHM9yZV3jMuJQ_OQLCgpg0",
  DEFAULT_CURRENCY: "৳"
};

// Global Supabase Client Instance
if (typeof supabase !== 'undefined') {
  window.db = supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);
  window.supabaseClient = window.db; // Safe alias
} else {
  console.error("Supabase CDN script is missing from HTML <head>.");
}
