import { listTracks, deleteTrack, deleteManyTracks, downloadUrl } from './api.js'
import { showToast } from './toast.js'

const container = document.getElementById('trackList')
const listSection = document.getElementById('trackListSection')

const PAGE_SIZE = 10
let selected = new Set()
let currentTracks = []
let total = 0
let currentOffset = 0

export async function refreshTrackList() {
  try {
    const { items, total: totalCount } = await listTracks({ limit: PAGE_SIZE, offset: currentOffset })
    currentTracks = items
    total = totalCount
    selected.clear()
    render()
    if (total > 0) listSection.classList.remove('hidden')
    else listSection.classList.add('hidden')
  } catch (e) {
    showToast(e.message ?? 'Failed to load tracks')
    listSection.classList.add('hidden')
  }
}

function render() {
  const hasSelection = selected.size > 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1

  container.innerHTML = `
    <div class="track-toolbar">
      <label class="track-toolbar-check">
        <input type="checkbox" id="selectAll" ${selected.size === currentTracks.length && currentTracks.length ? 'checked' : ''}>
        <span>${hasSelection ? selected.size + ' selected' : total + ' tracks'}</span>
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
    ${totalPages > 1 ? `
      <div class="pagination">
        <button class="pagination-btn" id="prevPage" ${currentPage <= 1 ? 'disabled' : ''}>&#8592; Prev</button>
        <span class="pagination-info">${currentPage} / ${totalPages}</span>
        <button class="pagination-btn" id="nextPage" ${currentPage >= totalPages ? 'disabled' : ''}>Next &#8594;</button>
      </div>
    ` : ''}
  `

  bindEvents()
}

function bindEvents() {
  document.getElementById('selectAll')?.addEventListener('change', (e) => {
    if (e.target.checked) currentTracks.forEach(t => selected.add(t.audioTrackId))
    else selected.clear()
    render()
  })

  container.querySelectorAll('.track-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(cb.dataset.id)
      else selected.delete(cb.dataset.id)
      render()
    })
  })

  container.querySelector('.delete-selected')?.addEventListener('click', async () => {
    const ids = [...selected]
    animateRemoval(ids)
    try {
      await deleteManyTracks(ids)
    } catch (e) {
      showToast(e.message ?? 'Delete failed')
    }
    await refreshTrackList()
  })

  container.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      animateRemoval([btn.dataset.id])
      await deleteTrack(btn.dataset.id)
      await refreshTrackList()
    })
  })

  document.getElementById('prevPage')?.addEventListener('click', () => {
    currentOffset = Math.max(0, currentOffset - PAGE_SIZE)
    refreshTrackList()
  })

  document.getElementById('nextPage')?.addEventListener('click', () => {
    currentOffset += PAGE_SIZE
    refreshTrackList()
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
