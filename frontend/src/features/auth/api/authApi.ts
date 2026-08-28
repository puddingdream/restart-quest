import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  AuthResponse,
  AuthUser,
  LoginInput,
  SignupInput,
} from '../types'
import { authMockApi } from './authMockApi'

export const authApi = {
  signup(input: SignupInput) {
    return apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: input,
      mock: () => authMockApi.signup(input),
    })
  },
  login(input: LoginInput) {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      mock: () => authMockApi.login(input),
    })
  },
  me() {
    return apiRequest<AuthUser>('/users/me', {
      mock: ({ accessToken }) => authMockApi.me(accessToken),
    })
  },
  logout() {
    return apiRequest<void>('/auth/logout', {
      method: 'POST',
      mock: async () => undefined,
    })
  },
}
