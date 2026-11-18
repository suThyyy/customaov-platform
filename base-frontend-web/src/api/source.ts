export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE && ['api', 'supabase'].includes(import.meta.env.VITE_DATA_SOURCE)
  ? import.meta.env.VITE_DATA_SOURCE as 'api' | 'supabase'
  : 'mock'

export type DataSource = typeof DATA_SOURCE
