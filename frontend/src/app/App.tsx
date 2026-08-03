import { AuthProvider } from '../features/auth/AuthContext'
import { AppRouter } from './AppRouter'

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
