const BASE = '/api/v1/audio'
const API_KEY = document.querySelector('meta[name="api-key"]')?.content ?? ''
const authHeaders = API_KEY ? { 'x-api-key': API_KEY } : {}

async function request(url, options = {}) {
  const { signal, ...rest } = options
  const res = await fetch(url, { ...rest, headers: { ...authHeaders, ...rest.headers }, signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(body.message ?? 'Request failed', { cause: body })
  }
  return res
}

export async function uploadAudio(file, effect) {
  const form = new FormData()
  form.append('file', file)
  form.append('effect', effect)
  const res = await request(BASE, { method: 'POST', body: form })
  return res.json()
}

export async function getStatus(trackId, { signal } = {}) {
  const res = await request(`${BASE}/${trackId}`, { signal })
  return res.json()
}

export async function listTracks({ limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const res = await request(`${BASE}?${params}`)
  return res.json()
}

export async function deleteTrack(trackId) {
  await request(`${BASE}/${trackId}`, { method: 'DELETE' })
}

export async function deleteManyTracks(trackIds) {
  const results = await Promise.allSettled(trackIds.map(id => deleteTrack(id)))
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length) {
    throw new Error(`${failed.length} of ${trackIds.length} deletions failed`, {
      cause: failed.map(r => r.reason),
    })
  }
}

export function downloadUrl(trackId) {
  return `${BASE}/${trackId}/download`
}
