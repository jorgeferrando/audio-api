import { listTracks, deleteTrack, deleteManyTracks, downloadUrl } from './api.js'

const container = document.getElementById('trackList')
const listSection = document.getElementById('trackListSection')

let selected = new Set()
let currentTracks = []

export async function refreshTrackList() {
  try {
    currentTracks = await listTracks()
    selected.clear()
    render()
    if (currentTracks.length) listSection.classList.remove('hidden')
    else listSection.classList.add('hidden')
  } catch {
    listSection.classList.add('hidden')
  }
}

function render() {
  const hasSelection = selected.size > 0

  container.innerHTML = `
    <div class="track-toolbar">
      <label class="track-toolbar-check">
        <input type="checkbox" id="selectAll" ${selected.size === currentTracks.length && currentTracks.length ? 'checked' : ''}>
        <span>${hasSelection ? selected.size + ' selected' : currentTracks.length + ' tracks'}</span>
      </label>
      ${hasSelection ? `
        <div class="track-toolbar-actions">
          <button class="toolbar-btn delete-selected" title="Delete selected">Delete (${selected.size})</button>
        </div>
      ` : ''}
    </div>
    ${currentTracks.map(t => `
      <div class="track-item ${selected.has(t.audioTrackId) ? 'selected' : ''}" data-id="${t.audioTrackId}">
        <input type="checkbox" class="track-check" data-id="${t.audioTrackId}" ${selected.has(t.audioTrackId) ? 'checked' : ''}>
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
    `).join('')}
  `

  // Select all
  document.getElementById('selectAll')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      currentTracks.forEach(t => selected.add(t.audioTrackId))
    } else {
      selected.clear()
    }
    render()
  })

  // Individual checkboxes
  container.querySelectorAll('.track-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.id)
      else selected.delete(cb.dataset.id)
      render()
    })
  })

  // Bulk delete
  container.querySelector('.delete-selected')?.addEventListener('click', async () => {
    const ids = [...selected]
    animateRemoval(ids)
    await deleteManyTracks(ids)
    await refreshTrackList()
  })

  // Single delete (no confirm — instant with animation)
  container.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      animateRemoval([id])
      await deleteTrack(id)
      await refreshTrackList()
    })
  })
}

function animateRemoval(ids) {
  ids.forEach(id => {
    const el = container.querySelector(`.track-item[data-id="${id}"]`)
    if (el) {
      el.style.transition = 'opacity 0.3s, transform 0.3s'
      el.style.opacity = '0'
      el.style.transform = 'translateX(20px)'
    }
  })
}

function badge(status) {
  return `<span class="badge ${status.toLowerCase()}">${status}</span>`
}
