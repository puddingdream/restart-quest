export interface AuthUser {
  id: string
  email: string
  name: string
  onboardingCompleted: boolean
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput extends LoginInput {
  name: string
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}

export interface AuthFormValues {
  email: string
  password: string
  name: string
}
