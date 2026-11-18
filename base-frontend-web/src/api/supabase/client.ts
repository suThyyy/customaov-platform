import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DATA_SOURCE } from '../source'

let singleton: SupabaseClient | null = null
let unitClient: SupabaseClient | null = null

/** Lazy: không khởi tạo Supabase client khi app chạy mock/API. */
export function getSupabaseClient(): SupabaseClient {
  if (unitClient) return unitClient
  if (DATA_SOURCE !== 'supabase') {
    throw new Error('Supabase client chỉ khả dụng khi VITE_DATA_SOURCE=supabase.')
  }
  if (singleton) return singleton
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    throw new Error('Thiếu cấu hình Supabase. Hãy điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong .env.local.')
  }
  singleton = createClient(url, anonKey)
  return singleton
}

/** Chỉ dùng trong unit test với fake client; không export qua api/index.ts. */
export function setSupabaseClientForUnitTests(client: SupabaseClient | null): void {
  unitClient = client
  singleton = null
}
