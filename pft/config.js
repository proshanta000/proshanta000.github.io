// Supabase Public Configuration
const CONFIG = {
  SUPABASE_URL: "https://kmtubcmuitlyjrvotixg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_RLp83gLkdcHM9yZV3jMuJQ_OQLCgpg0",
  DEFAULT_CURRENCY: "৳"
};

// Global Supabase Client Instances
var db = null;
var supabaseClient = null;

if (typeof supabase !== 'undefined') {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  supabaseClient = db; // Alias to prevent undefined errors if script.js uses supabaseClient
} else {
  console.error("Supabase JS SDK failed to load from CDN.");
}
