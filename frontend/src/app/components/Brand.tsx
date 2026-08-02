import { AppLink } from './AppLink'

export function Brand() {
  return (
    <AppLink className="brand" to="/" aria-label="Re:Start Quest 홈">
      <span className="brand-mark" aria-hidden="true">
        R
      </span>
      <span>
        Re:Start <strong>Quest</strong>
      </span>
    </AppLink>
  )
}
