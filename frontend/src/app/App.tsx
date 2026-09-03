import { AppShell } from './AppShell'
import { AuthApp } from '../features/auth/AuthApp'

export function App() {
  return (
    <AppShell>
      <AuthApp />
    </AppShell>
  )
}
