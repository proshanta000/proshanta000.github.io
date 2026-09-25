// Supabase Public Configuration
const CONFIG = {
  SUPABASE_URL: "https://your-supabase-project-id.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here",
  DEFAULT_CURRENCY: "৳"
};

// Global Supabase Client Instance
let db = null;
if (typeof supabase !== 'undefined') {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
} else {
  console.error("Supabase JS SDK failed to load from CDN.");
}
