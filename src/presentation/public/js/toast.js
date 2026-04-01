const TOAST_DURATION_MS = 4000

let container = null

function ensureContainer() {
  if (container) return container
  container = document.createElement('div')
  container.className = 'toast-container'
  document.body.appendChild(container)
  return container
}

export function showToast(message, type = 'error') {
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message

  ensureContainer().appendChild(el)

  // Trigger entrance animation
  requestAnimationFrame(() => el.classList.add('visible'))

  setTimeout(() => {
    el.classList.remove('visible')
    el.addEventListener('transitionend', () => el.remove())
  }, TOAST_DURATION_MS)
}
