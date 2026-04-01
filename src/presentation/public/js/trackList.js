import { listTracks, deleteTrack, downloadUrl } from './api.js'
import { STATUS } from './constants.js'

const container = document.getElementById('trackList')
const listSection = document.getElementById('trackListSection')

export async function refreshTrackList() {
  try {
    const tracks = await listTracks()
    render(tracks)
    listSection.style.display = tracks.length ? 'block' : 'none'
  } catch {
    listSection.style.display = 'none'
  }
}

function render(tracks) {
  container.innerHTML = tracks.map(t => `
    <div class="track-item" data-id="${t.audioTrackId}">
      <div class="info">
        <span class="name">${t.filename}</span>
        <span class="meta">
          ${badge(t.status)}
          ${t.durationSeconds ? ' &middot; ' + t.durationSeconds + 's' : ''}
        </span>
      </div>
      <div class="actions">
        ${t.downloadReady
          ? `<a class="action-btn download" href="${downloadUrl(t.audioTrackId)}" title="Download">&#8615;</a>`
          : ''}
        <button class="action-btn delete" data-id="${t.audioTrackId}" title="Delete">&times;</button>
      </div>
    </div>
  `).join('')

  container.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this track?')) return
      btn.disabled = true
      try {
        await deleteTrack(btn.dataset.id)
        await refreshTrackList()
      } catch {
        btn.disabled = false
      }
    })
  })
}

function badge(status) {
  return `<span class="badge ${status.toLowerCase()}">${status}</span>`
}
