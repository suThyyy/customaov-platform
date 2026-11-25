export function resolveDataSource(value: unknown): 'api' | 'supabase' | 'mock' | 'invalid' {
  return value === 'api' || value === 'supabase' || value === 'mock' ? value : 'invalid'
}

export const DATA_SOURCE = resolveDataSource(import.meta.env.VITE_DATA_SOURCE)

export type DataSource = typeof DATA_SOURCE
