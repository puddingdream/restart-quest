import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearAccessToken,
  getAccessToken,
  storeAccessToken,
} from './sessionToken'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('access token은 sessionStorage에만 저장하고 삭제한다', () => {
  const sessionStorage = createMemoryStorage()
  const localStorage = createMemoryStorage()
  const location = { href: 'https://restart.quest/login' }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage, localStorage, location },
  })

  try {
    storeAccessToken('test-only-token')
    assert.equal(getAccessToken(), 'test-only-token')
    assert.equal(localStorage.length, 0)
    assert.equal(location.href, 'https://restart.quest/login')

    clearAccessToken()
    assert.equal(getAccessToken(), null)
  } finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
})
