import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xiwuefhgkteqgmbnsrrb.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Txj2BlizNZXZcxonSqURWA_x9cjsi-Q'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
