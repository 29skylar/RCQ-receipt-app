import { createClient } from "@/lib/supabase/browser";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/** Browser Supabase client with cookie-based auth (use in client components). */
export const supabase = createClient();

/** @deprecated Import createClient from ./browser instead. */
export { getSupabaseUrl, getSupabaseAnonKey };
