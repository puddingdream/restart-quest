type QueryEntry<T> = {
  promise?: Promise<T>
  value?: T
}

export class QueryClient {
  private readonly entries = new Map<string, QueryEntry<unknown>>()

  async fetchQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key) as QueryEntry<T> | undefined

    if (existing && 'value' in existing) {
      return existing.value as T
    }

    if (existing?.promise) {
      return existing.promise
    }

    const promise = fetcher()
      .then((value) => {
        this.entries.set(key, { value })
        return value
      })
      .catch((error: unknown) => {
        this.entries.delete(key)
        throw error
      })

    this.entries.set(key, { promise })
    return promise
  }

  invalidate(key: string): void {
    this.entries.delete(key)
  }

  setQueryData<T>(key: string, value: T): void {
    this.entries.set(key, { value })
  }
}

export const queryClient = new QueryClient()
