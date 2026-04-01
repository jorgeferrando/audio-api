import { getStatus, downloadUrl } from './api.js'
import { STATUS, POLL_INTERVAL_MS } from './constants.js'

export function startPolling(trackId, { onUpdate, onReady, onFailed }) {
  onUpdate({ status: STATUS.PENDING, job: { status: STATUS.PENDING } }, trackId)

  const timer = setInterval(async () => {
    try {
      const data = await getStatus(trackId)
      onUpdate(data, trackId)

      if (data.status === STATUS.READY) {
        clearInterval(timer)
        onReady(data, trackId)
      }
      if (data.status === STATUS.FAILED) {
        clearInterval(timer)
        onFailed(data, trackId)
      }
    } catch { /* keep polling */ }
  }, POLL_INTERVAL_MS)

  return () => clearInterval(timer)
}

export function renderStatus(data, trackId) {
  const rows = [
    ['Track ID',  truncate(trackId)],
    ['Filename',  data.filename || '-'],
    ['Status',    badge(data.status)],
    ['Job',       data.job ? badge(data.job.status) : '-'],
  ]
  if (data.durationSeconds) rows.push(['Duration', data.durationSeconds + 's'])

  document.getElementById('statusRows').innerHTML = rows.map(([label, value]) => `
    <div class="status-row">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
    </div>
  `).join('')

  const dl = document.getElementById('downloadLink')
  const processedSection = document.getElementById('processedSection')
  const processedPlayer = document.getElementById('processedPlayer')

  if (data.status === STATUS.READY) {
    const url = downloadUrl(trackId)
    dl.href = url
    dl.style.display = 'block'
    processedPlayer.src = url
    processedSection.style.display = 'block'
  } else {
    dl.style.display = 'none'
    processedSection.style.display = 'none'
  }
}

function badge(status) {
  const cls = 'badge ' + status.toLowerCase()
  const icon = (status === STATUS.PENDING || status === STATUS.PROCESSING)
    ? '<span class="spinner"></span>' : ''
  return `<span class="badge ${cls}">${icon}${status}</span>`
}

function truncate(str) {
  return str && str.length > 20 ? str.slice(0, 8) + '...' + str.slice(-8) : str
}
