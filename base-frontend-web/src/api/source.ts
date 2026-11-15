export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'

export type DataSource = typeof DATA_SOURCE
