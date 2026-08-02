export function QuestSkeletons({ label }: { label: string }) {
  return (
    <section className="quest-loading" role="status" aria-live="polite">
      <p className="visually-hidden">{label}</p>
      <div className="quest-grid" aria-hidden="true">
        {[1, 2, 3].map((position) => (
          <article className="quest-card quest-card-skeleton" key={position}>
            <span className="skeleton-line skeleton-meta" />
            <span className="skeleton-line skeleton-title" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-short" />
            <span className="skeleton-block" />
          </article>
        ))}
      </div>
    </section>
  )
}
