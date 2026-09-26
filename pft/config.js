// Supabase Configuration
window.CONFIG = {
  SUPABASE_URL: "https://kmtubcmuitlyjrvotixg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_RLp83gLkdcHM9yZV3jMuJQ_OQLCgpg0",
  DEFAULT_CURRENCY: "৳"
};

// Global Supabase Client Instance
(function initializeSupabase() {
  if (typeof supabase === 'undefined') {
    console.error('Supabase CDN script is missing from index.html.');
    return;
  }

  if (!window.CONFIG.SUPABASE_URL || !window.CONFIG.SUPABASE_ANON_KEY) {
    console.error('Supabase URL or publishable key is missing from config.js.');
    return;
  }

  try {
    window.db = supabase.createClient(
      window.CONFIG.SUPABASE_URL,
      window.CONFIG.SUPABASE_ANON_KEY
    );
    window.supabaseClient = window.db;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
  }
})();
