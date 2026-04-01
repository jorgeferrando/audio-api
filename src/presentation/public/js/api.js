const BASE = '/api/v1/audio'
const API_KEY = document.querySelector('meta[name="api-key"]')?.content || ''
const headers = API_KEY ? { 'x-api-key': API_KEY } : {}

export async function uploadAudio(file, effect) {
  const form = new FormData()
  form.append('file', file)
  form.append('effect', effect)
  const res = await fetch(BASE, { method: 'POST', body: form, headers })
  if (!res.ok) throw await res.json()
  return res.json()
}

export async function getStatus(trackId) {
  const res = await fetch(`${BASE}/${trackId}`, { headers })
  if (!res.ok) throw await res.json()
  return res.json()
}

export async function listTracks() {
  const res = await fetch(BASE, { headers })
  if (!res.ok) throw await res.json()
  return res.json()
}

export async function deleteTrack(trackId) {
  const res = await fetch(`${BASE}/${trackId}`, { method: 'DELETE', headers })
  if (!res.ok) throw await res.json()
}

export async function deleteManyTracks(trackIds) {
  await Promise.all(trackIds.map(id => deleteTrack(id)))
}

export function downloadUrl(trackId) {
  return `${BASE}/${trackId}/download`
}

export function downloadUrlWithAuth(trackId) {
  const params = API_KEY ? `?key=${API_KEY}` : ''
  return `${BASE}/${trackId}/download${params}`
}
