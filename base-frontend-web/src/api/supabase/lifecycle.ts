type Cleanup = () => void | Promise<void>

const cleanups = new Set<Cleanup>()

export function registerSupabaseCleanup(cleanup: Cleanup): () => void {
  cleanups.add(cleanup)
  return () => cleanups.delete(cleanup)
}

export async function clearSupabaseRuntime(): Promise<void> {
  const pending = [...cleanups]
  cleanups.clear()
  await Promise.allSettled(pending.map((cleanup) => cleanup()))
}
