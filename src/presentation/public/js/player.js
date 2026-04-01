function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m + ':' + String(sec).padStart(2, '0')
}

export function initPlayer(playerEl) {
  const audioId   = playerEl.dataset.for
  const audio     = document.getElementById(audioId)
  const btn       = playerEl.querySelector('.play-btn')
  const iconPlay  = btn.querySelector('.icon-play')
  const iconPause = btn.querySelector('.icon-pause')
  const bar       = playerEl.querySelector('.bar')
  const barWrap   = playerEl.querySelector('.bar-wrap')
  const time      = playerEl.querySelector('.time')
  let animFrame   = null

  function updateProgress() {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0
    bar.style.width = pct + '%'
    time.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration)
    if (!audio.paused) animFrame = requestAnimationFrame(updateProgress)
  }

  btn.addEventListener('click', () => {
    if (audio.paused) audio.play(); else audio.pause()
  })

  audio.addEventListener('play', () => {
    iconPlay.style.display = 'none'
    iconPause.style.display = 'inline'
    animFrame = requestAnimationFrame(updateProgress)
  })

  audio.addEventListener('pause', () => {
    iconPlay.style.display = 'inline'
    iconPause.style.display = 'none'
    if (animFrame) cancelAnimationFrame(animFrame)
  })

  audio.addEventListener('loadedmetadata', () => {
    time.textContent = '0:00 / ' + fmtTime(audio.duration)
  })

  audio.addEventListener('ended', () => {
    iconPlay.style.display = 'inline'
    iconPause.style.display = 'none'
    if (animFrame) cancelAnimationFrame(animFrame)
    bar.style.width = '0%'
  })

  barWrap.addEventListener('click', (e) => {
    if (!audio.duration) return
    const rect = barWrap.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration
  })
}

export function initAllPlayers() {
  document.querySelectorAll('.player').forEach(initPlayer)
}
