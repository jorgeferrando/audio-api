import { showToast } from './toast.js'

/**
 * Audio magic byte signatures — mirrors the backend audioSignatures.ts.
 * Each entry: [offset, expected bytes].
 */
const AUDIO_SIGNATURES = [
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], offset2: 8, bytes2: [0x57, 0x41, 0x56, 0x45] }, // WAV: RIFF + WAVE
  { offset: 0, bytes: [0x49, 0x44, 0x33] },       // MP3 ID3v2
  { offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] }, // OGG
  { offset: 0, bytes: [0x66, 0x4C, 0x61, 0x43] }, // FLAC
  { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // WebM/EBML
]

/** MPEG sync bytes — checked separately due to multiple variants. */
const MPEG_SYNC = [0xFB, 0xF3, 0xF2] // MP3
const AAC_SYNC  = [0xF1, 0xF9]       // AAC ADTS

function isAudioHeader(view) {
  // Check fixed-offset signatures
  for (const sig of AUDIO_SIGNATURES) {
    if (view.byteLength < sig.offset + sig.bytes.length) continue
    const match = sig.bytes.every((b, i) => view.getUint8(sig.offset + i) === b)
    if (!match) continue
    // WAV needs second check at offset 8
    if (sig.bytes2) {
      if (view.byteLength < sig.offset2 + sig.bytes2.length) continue
      if (sig.bytes2.every((b, i) => view.getUint8(sig.offset2 + i) === b)) return true
    } else {
      return true
    }
  }

  // Check 0xFF-prefixed formats (MP3 frame sync, AAC ADTS)
  if (view.byteLength >= 2 && view.getUint8(0) === 0xFF) {
    const second = view.getUint8(1)
    if (MPEG_SYNC.includes(second) || AAC_SYNC.includes(second)) return true
  }

  return false
}

export function initUploader({ onFileSelected }) {
  const dropzone = document.getElementById('dropzone')
  const fileInput = document.getElementById('fileInput')
  const filenameEl = document.getElementById('dropzone-filename')
  const iconEl = document.getElementById('dropzone-icon')
  const textEl = document.getElementById('dropzone-text')

  dropzone.addEventListener('click', () => fileInput.click())

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.classList.add('dropzone--drag-over')
  })

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone--drag-over'))

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('dropzone--drag-over')
    if (e.dataTransfer.files.length) validateAndSelect(e.dataTransfer.files[0])
  })

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) validateAndSelect(fileInput.files[0])
  })

  async function validateAndSelect(file) {
    const header = await file.slice(0, 12).arrayBuffer()
    const view = new DataView(header)

    if (!isAudioHeader(view)) {
      showToast('File does not appear to be a valid audio file')
      return
    }

    selectFile(file)
  }

  function selectFile(file) {
    iconEl.textContent = '\u2713'
    textEl.textContent = ''
    filenameEl.textContent = file.name + ' (' + formatSize(file.size) + ')'
    dropzone.classList.add('dropzone--has-file')
    onFileSelected(file)
  }

  return { selectFile }
}

export function initDemoTone(onFileGenerated) {
  const link = document.getElementById('demoLink')

  link.addEventListener('click', async () => {
    link.textContent = 'Generating...'
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
      const blob = encodeWAV(buffer)
      const file = new File([blob], 'demo-440hz.wav', { type: 'audio/wav' })
      onFileGenerated(file)
      ctx.close()
    } catch {
      link.textContent = 'Failed to generate demo'
    }
    link.textContent = 'or use a demo tone (3s sine wave)'
  })
}

function encodeWAV(buffer) {
  const ch = buffer.numberOfChannels
  const sr = buffer.sampleRate
  const samples = buffer.getChannelData(0)
  const dataSize = samples.length * ch * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0,'RIFF'); v.setUint32(4,36+dataSize,true); w(8,'WAVE'); w(12,'fmt ')
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true)
  v.setUint32(24,sr,true); v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true)
  v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,dataSize,true)
  let o = 44
  for (let i = 0; i < samples.length; i++) {
    v.setInt16(o, Math.max(-1,Math.min(1,samples[i])) * 0x7FFF, true); o += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
