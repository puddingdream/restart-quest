export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="screen-loading" role="status">
      <span className="brand-mark" aria-hidden="true">
        R
      </span>
      <span className="spinner spinner-dark" aria-hidden="true" />
      <p>{label}</p>
    </main>
  )
}
