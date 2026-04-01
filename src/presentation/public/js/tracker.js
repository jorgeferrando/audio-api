import { getStatus, downloadUrl } from './api.js'
import { STATUS, POLL_INTERVAL_MS } from './constants.js'
import { show, hide } from './dom.js'

export function startPolling(trackId, { onUpdate, onReady, onFailed }) {
  const controller = new AbortController()
  const { signal } = controller

  onUpdate({ status: STATUS.PENDING, job: { status: STATUS.PENDING } }, trackId)

  const timer = setInterval(async () => {
    if (signal.aborted) return

    try {
      const data = await getStatus(trackId, { signal })
      onUpdate(data, trackId)

      if (data.status === STATUS.READY) {
        clearInterval(timer)
        onReady(data, trackId)
      }
      if (data.status === STATUS.FAILED) {
        clearInterval(timer)
        onFailed(data, trackId)
      }
    } catch (e) {
      if (e.name === 'AbortError') return
      /* network error — keep polling */
    }
  }, POLL_INTERVAL_MS)

  // Return cancel function — aborts in-flight fetch + clears timer
  return () => {
    controller.abort()
    clearInterval(timer)
  }
}

export function renderStatus(data, trackId) {
  const { filename = '-', status, job, durationSeconds } = data

  const rows = [
    ['Track ID',  truncate(trackId)],
    ['Filename',  filename],
    ['Status',    badge(status)],
    ['Job',       job ? badge(job.status) : '-'],
  ]
  if (durationSeconds) rows.push(['Duration', `${durationSeconds}s`])

  document.getElementById('statusRows').innerHTML = rows
    .map(([label, value]) => `
      <div class="status-row">
        <span class="label">${label}</span>
        <span class="value">${value}</span>
      </div>
    `).join('')

  const dl = document.getElementById('downloadLink')
  const processedSection = document.getElementById('processedSection')
  const processedPlayer = document.getElementById('processedPlayer')

  if (status === STATUS.READY) {
    const url = downloadUrl(trackId)
    dl.href = url
    show(dl)
    processedPlayer.src = url
    show(processedSection)
  } else {
    hide(dl)
    hide(processedSection)
  }
}

function badge(status) {
  const isActive = [STATUS.PENDING, STATUS.PROCESSING].some(s => s === status)
  const icon = isActive ? '<span class="spinner"></span>' : ''
  return `<span class="badge ${status.toLowerCase()}">${icon}${status}</span>`
}

function truncate(str) {
  return str?.length > 20 ? `${str.slice(0, 8)}...${str.slice(-8)}` : str ?? ''
}
