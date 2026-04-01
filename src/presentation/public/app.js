const API = '/api/v1/audio'
const API_KEY = document.querySelector('meta[name="api-key"]')?.content || ''
const authHeaders = API_KEY ? { 'x-api-key': API_KEY } : {}
let selectedFile = null
let pollTimer = null

const $ = (id) => document.getElementById(id)
const dropzone   = $('dropzone')
const fileInput  = $('fileInput')
const uploadBtn  = $('uploadBtn')
const uploadErr  = $('uploadError')

// ── Drag & drop / click ──────────────────────

dropzone.addEventListener('click', () => fileInput.click())
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over') })
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'))
dropzone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropzone.classList.remove('drag-over')
  if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0])
})
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) selectFile(fileInput.files[0])
})

// ── Demo tone ────────────────────────────────

$('demoLink').addEventListener('click', async () => {
  $('demoLink').textContent = 'Generating...'
  try {
    const ctx = new AudioContext({ sampleRate: 44100 })
    const duration = 3
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      const envelope = Math.min(t * 10, 1) * Math.min((duration - t) * 10, 1)
      data[i] = Math.sin(2 * Math.PI * 440 * t) * 0.5 * envelope
    }
    const wavBlob = encodeWAV(buffer)
    const file = new File([wavBlob], 'demo-440hz.wav', { type: 'audio/wav' })
    selectFile(file)
    ctx.close()
  } catch (e) {
    $('demoLink').textContent = 'Failed to generate demo'
  }
})

function encodeWAV(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const samples = buffer.getChannelData(0)
  const byteRate = sampleRate * numChannels * 2
  const blockAlign = numChannels * 2
  const dataSize = samples.length * numChannels * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s * 0x7FFF, true)
    offset += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// ── File selection ───────────────────────────

function selectFile(file) {
  selectedFile = file
  $('dropzone-icon').textContent = '\u2713'
  $('dropzone-text').textContent = ''
  $('dropzone-filename').textContent = file.name + ' (' + formatSize(file.size) + ')'
  dropzone.classList.add('has-file')
  uploadBtn.disabled = false
  uploadErr.textContent = ''
  $('demoLink').textContent = 'or use a demo tone (3s sine wave)'

  const url = URL.createObjectURL(file)
  $('originalPlayer').src = url
  $('originalSection').style.display = 'block'
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ── Upload ───────────────────────────────────

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return
  uploadBtn.disabled = true
  uploadBtn.textContent = 'Uploading...'
  uploadErr.textContent = ''
  $('result').style.display = 'none'
  $('processedSection').style.display = 'none'
  if (pollTimer) clearInterval(pollTimer)

  const form = new FormData()
  form.append('file', selectedFile)
  form.append('effect', $('effect').value)

  try {
    const res = await fetch(API, { method: 'POST', body: form, headers: authHeaders })
    const data = await res.json()

    if (!res.ok) {
      uploadErr.textContent = data.message || 'Upload failed'
      uploadBtn.disabled = false
      uploadBtn.textContent = 'Upload & Process'
      return
    }

    uploadBtn.textContent = 'Upload & Process'
    startPolling(data.audioTrackId)
  } catch (e) {
    uploadErr.textContent = 'Network error'
    uploadBtn.disabled = false
    uploadBtn.textContent = 'Upload & Process'
  }
})

// ── Polling ──────────────────────────────────

function startPolling(trackId) {
  $('result').style.display = 'block'
  renderStatus({ status: 'PENDING', job: { status: 'PENDING' } }, trackId)

  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/${trackId}`, { headers: authHeaders })
      const data = await res.json()
      renderStatus(data, trackId)

      if (data.status === 'READY' || data.status === 'FAILED') {
        clearInterval(pollTimer)
        uploadBtn.disabled = false
      }
    } catch (e) { /* keep polling */ }
  }, 1000)
}

function renderStatus(data, trackId) {
  const rows = [
    ['Track ID',  truncate(data.audioTrackId || trackId)],
    ['Filename',  data.filename || '-'],
    ['Status',    badge(data.status)],
    ['Job',       data.job ? badge(data.job.status) : '-'],
  ]
  if (data.durationSeconds) rows.push(['Duration', data.durationSeconds + 's'])

  $('statusRows').innerHTML = rows.map(([label, value]) => `
    <div class="status-row">
      <span class="status-label">${label}</span>
      <span class="status-value">${value}</span>
    </div>
  `).join('')

  const dl = $('downloadLink')
  if (data.status === 'READY') {
    const downloadUrl = `${API}/${trackId}/download`
    dl.href = downloadUrl
    dl.style.display = 'block'

    $('processedPlayer').src = downloadUrl
    $('processedSection').style.display = 'block'
  } else {
    dl.style.display = 'none'
    $('processedSection').style.display = 'none'
  }
}

function badge(status) {
  const cls = 'badge-' + status.toLowerCase()
  const icon = status === 'PENDING' || status === 'PROCESSING'
    ? '<span class="spinner"></span>' : ''
  return `<span class="badge ${cls}">${icon}${status}</span>`
}

function truncate(str) {
  return str && str.length > 20 ? str.slice(0, 8) + '...' + str.slice(-8) : str
}

// ── Custom audio players ─────────────────────

function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m + ':' + String(sec).padStart(2, '0')
}

document.querySelectorAll('.player').forEach(player => {
  const audioId = player.dataset.for
  const audio   = document.getElementById(audioId)
  const btn     = player.querySelector('.play-btn')
  const iconPlay  = btn.querySelector('.icon-play')
  const iconPause = btn.querySelector('.icon-pause')
  const bar     = player.querySelector('.player-bar')
  const barWrap = player.querySelector('.player-bar-wrap')
  const time    = player.querySelector('.player-time')

  btn.addEventListener('click', () => {
    if (audio.paused) { audio.play() } else { audio.pause() }
  })

  audio.addEventListener('play', () => {
    iconPlay.style.display = 'none'
    iconPause.style.display = 'inline'
  })
  audio.addEventListener('pause', () => {
    iconPlay.style.display = 'inline'
    iconPause.style.display = 'none'
  })

  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0
    bar.style.width = pct + '%'
    time.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration)
  })

  audio.addEventListener('loadedmetadata', () => {
    time.textContent = '0:00 / ' + fmtTime(audio.duration)
  })

  audio.addEventListener('ended', () => {
    iconPlay.style.display = 'inline'
    iconPause.style.display = 'none'
    bar.style.width = '0%'
  })

  barWrap.addEventListener('click', (e) => {
    if (!audio.duration) return
    const rect = barWrap.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * audio.duration
  })
})
