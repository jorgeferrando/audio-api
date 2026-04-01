import { uploadAudio } from './api.js'
import { initUploader, initDemoTone } from './uploader.js'
import { initAllPlayers } from './player.js'
import { startPolling, renderStatus } from './tracker.js'
import { refreshTrackList } from './trackList.js'
import { show, hide } from './dom.js'
import { showToast } from './toast.js'

let selectedFile = null
let cancelPolling = null

const uploadBtn = document.getElementById('uploadBtn')
const uploadErr = document.getElementById('uploadError')
const resultCard = document.getElementById('result')
const originalPlayer = document.getElementById('originalPlayer')
const originalSection = document.getElementById('originalSection')

// ── File selection ──────────────────────────────

function onFileSelected(file) {
  selectedFile = file
  uploadBtn.disabled = false
  uploadErr.textContent = ''

  originalPlayer.src = URL.createObjectURL(file)
  show(originalSection)
}

const { selectFile } = initUploader({ onFileSelected })
initDemoTone(selectFile)
initAllPlayers()

// ── Upload ──────────────────────────────────────

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return

  // Cancel previous polling if any
  cancelPolling?.()

  uploadBtn.disabled = true
  uploadBtn.textContent = 'Uploading...'
  uploadErr.textContent = ''
  hide(resultCard)

  try {
    const effect = document.getElementById('effect').value
    const { audioTrackId } = await uploadAudio(selectedFile, effect)

    uploadBtn.textContent = 'Upload & Process'
    show(resultCard)

    cancelPolling = startPolling(audioTrackId, {
      onUpdate: renderStatus,
      onReady: () => {
        uploadBtn.disabled = false
        refreshTrackList()
      },
      onFailed: () => {
        uploadBtn.disabled = false
      },
    })
  } catch (e) {
    showToast(e.message ?? 'Upload failed')
    uploadBtn.disabled = false
    uploadBtn.textContent = 'Upload & Process'
  }
})

// ── Initial load ────────────────────────────────

refreshTrackList()
