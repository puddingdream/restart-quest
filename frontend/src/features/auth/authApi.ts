import { apiClient, type ApiClient } from '../../lib/api/ApiClient'
import { parseAuthResponse, type User } from '../../lib/api/contracts'

export type Credentials = {
  email: string
  password: string
}

export interface AuthApi {
  login(credentials: Credentials): Promise<User>
  logout(): Promise<void>
  me(): Promise<User>
  onUnauthorized(listener: () => void): () => void
  register(credentials: Credentials): Promise<User>
}

export class HttpAuthApi implements AuthApi {
  constructor(private readonly client: ApiClient) {}

  async login(credentials: Credentials): Promise<User> {
    const response = await this.client.write('/api/v1/auth/login', {
      body: credentials,
      parse: parseAuthResponse,
      rotatesSession: true,
    })
    return response.user
  }

  async logout(): Promise<void> {
    await this.client.write('/api/v1/auth/logout', { rotatesSession: true })
  }

  async me(): Promise<User> {
    const response = await this.client.get('/api/v1/auth/me', parseAuthResponse)
    return response.user
  }

  onUnauthorized(listener: () => void): () => void {
    return this.client.onUnauthorized(listener)
  }

  async register(credentials: Credentials): Promise<User> {
    const response = await this.client.write('/api/v1/auth/register', {
      body: credentials,
      parse: parseAuthResponse,
      rotatesSession: true,
    })
    return response.user
  }
}

export const authApi = new HttpAuthApi(apiClient)
