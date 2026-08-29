export type ApiMode = 'http' | 'mock'

export function resolveApiMode(
  configuredMode: string | undefined,
  documentMode: string | null | undefined,
): ApiMode {
  if (configuredMode !== undefined) {
    return configuredMode === 'mock' ? 'mock' : 'http'
  }

  return documentMode === 'mock' ? 'mock' : 'http'
}
