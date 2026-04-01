import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { show, hide } from './dom.js'

describe('dom utilities', () => {
  let el

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><div id="test" class="hidden"></div>')
    el = dom.window.document.getElementById('test')
  })

  it('show() removes the hidden class', () => {
    show(el)
    expect(el.classList.contains('hidden')).toBe(false)
  })

  it('hide() adds the hidden class', () => {
    el.classList.remove('hidden')
    hide(el)
    expect(el.classList.contains('hidden')).toBe(true)
  })

  it('show() is idempotent', () => {
    show(el)
    show(el)
    expect(el.className).toBe('')
  })

  it('hide() is idempotent', () => {
    hide(el)
    hide(el)
    expect(el.classList.contains('hidden')).toBe(true)
  })
})
