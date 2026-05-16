import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log("Supabase URL exists:", !!supabaseUrl);
console.log("Supabase Anon Key exists:", !!supabaseKey);

// Provide fallback dummy values so the app can mount and we can see the console logs
// instead of immediately crashing with "supabaseUrl is required".
export const supabase = createClient(
  supabaseUrl || "https://dummy.supabase.co",
  supabaseKey || "dummy_anon_key",
);
