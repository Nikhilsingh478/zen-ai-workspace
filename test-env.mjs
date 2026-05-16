import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), '');
console.log("VITE_SUPABASE_URL:", env.VITE_SUPABASE_URL);
console.log("VITE_SUPABASE_ANON_KEY:", env.VITE_SUPABASE_ANON_KEY);
console.log("VITE_GEMINI_API_KEY:", env.VITE_GEMINI_API_KEY);
