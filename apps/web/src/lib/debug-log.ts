import { createClient } from '@/lib/supabase/client'

let debugEnabled: boolean | null = null

async function fetchDebugFlag(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'debug_logging')
      .single()

    return data?.value === true || data?.value === 'true'
  } catch {
    return false
  }
}

/**
 * Log a debug message only when `debug_logging` is enabled in system_config.
 * Fetches the flag once per page load, then caches it.
 */
export function debugLog(namespace: string, message: string, meta?: object) {
  if (debugEnabled === false) return

  if (debugEnabled === true) {
    if (meta) {
      console.debug(`[${namespace}] ${message}`, meta)
    } else {
      console.debug(`[${namespace}] ${message}`)
    }
    return
  }

  // First call — fire-and-forget fetch, then log if enabled
  fetchDebugFlag().then((enabled) => {
    debugEnabled = enabled
    if (enabled) {
      if (meta) {
        console.debug(`[${namespace}] ${message}`, meta)
      } else {
        console.debug(`[${namespace}] ${message}`)
      }
    }
  })
}
