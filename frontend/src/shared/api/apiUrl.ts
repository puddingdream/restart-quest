const API_BASE_PATH = '/api/v1'

export function createApiUrl(
  path: string,
  configuredBase: string | undefined,
): string {
  const baseUrl = configuredBase?.replace(/\/$/, '') ?? ''
  return `${baseUrl}${API_BASE_PATH}${path}`
}
