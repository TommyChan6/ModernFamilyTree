// Configured Supabase client for the renderer / web build.
//
// Reads the connection details from Vite env vars (VITE_ prefix = exposed to
// the client bundle). Set them in the project-root .env — see that file for
// where to find each value in the Supabase dashboard.
//
// The anon key is a public credential by design; Row Level Security (see
// supabase/schema.sql) is what actually guards the data.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loud and early if the .env isn't filled in, rather than getting cryptic
// network errors deep inside a query later.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
