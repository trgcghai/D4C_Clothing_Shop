import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, setAccessToken, setRefreshTokenHandler } from './http'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('http client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setAccessToken(null)
    setRefreshTokenHandler(null)
  })

  it('returns undefined for 2xx responses without body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    await expect(http('/empty-success')).resolves.toBeUndefined()
  })

  it('returns text for successful non-json responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    )

    await expect(http<string>('/text-success')).resolves.toBe('ok')
  })

  it('passes through BodyInit payloads without stringifying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const payload = new Uint8Array([1, 2, 3])

    await http('/binary', { method: 'POST', body: payload })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(payload)
  })

  it('sends credentials include by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await http('/credentialed')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBe('include')
  })

  it('allows credentials override when provided explicitly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await http('/credentialed', { credentials: 'same-origin' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBe('same-origin')
  })

  it('shares one in-flight refresh request across concurrent 401s', async () => {
    let releaseRefresh: (value: string | null) => void = () => {}
    const refreshPromise = new Promise<string | null>((resolve) => {
      releaseRefresh = resolve
    })
    const refreshMock = vi.fn().mockReturnValue(refreshPromise)
    setRefreshTokenHandler(refreshMock)

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const authHeader =
        init?.headers && !Array.isArray(init.headers)
          ? (init.headers as Record<string, string>).Authorization
          : undefined

      if (authHeader === 'Bearer fresh-token') {
        return jsonResponse({ ok: true })
      }

      return new Response(null, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = http<{ ok: boolean }>('/resource')
    const second = http<{ ok: boolean }>('/resource')

    await Promise.resolve()
    expect(refreshMock).toHaveBeenCalledTimes(1)

    releaseRefresh('fresh-token')

    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }])
  })

  it('clears the in-memory token when refresh fails', async () => {
    const refreshMock = vi.fn().mockResolvedValue(null)
    setRefreshTokenHandler(refreshMock)
    setAccessToken('expired-token')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(http('/resource')).rejects.toMatchObject({ status: 401 })
    await http('/follow-up')

    expect(refreshMock).toHaveBeenCalledTimes(1)
    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect((secondInit.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('does not recurse when the refresh endpoint itself returns 401', async () => {
    const refreshMock = vi.fn().mockResolvedValue('fresh-token')
    setRefreshTokenHandler(refreshMock)

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(http('/api/auth/refresh-token')).rejects.toMatchObject({ status: 401 })
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
