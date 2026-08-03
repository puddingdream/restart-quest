import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  AuthResponse,
  AuthUser,
  LoginInput,
  SignupInput,
} from '../types'

export const authApi = {
  signup(input: SignupInput) {
    return apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: input,
    })
  },
  login(input: LoginInput) {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
    })
  },
  me() {
    return apiRequest<AuthUser>('/users/me')
  },
}
