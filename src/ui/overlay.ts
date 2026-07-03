// All the on-screen 2D layer. Pure DOM so it stays crisp and cheap, styled by
// overlay.css to match the warm hand-drawn palette.

export interface TaskItem {
  id: string
  title: string
  done: boolean
  available: boolean
  current?: boolean
  // Delivery-state annotation, e.g. "(order online)" / "(on the porch)".
  note?: string | null
}

export interface ShopEntry {
  id: string
  name: string
  status: 'locked' | 'orderable' | 'shipping' | 'porch' | 'carrying' | 'placed'
  lockNote?: string
}

export interface GuideInfo {
  title: string
  distance: number
  angle: number
}

export class Overlay {
  private root: HTMLElement
  private crosshair: HTMLDivElement
  private prompt: HTMLDivElement
  private list: HTMLDivElement
  private listUl: HTMLUListElement
  private guide: HTMLDivElement
  private guideArrow: HTMLDivElement
  private guideTitle: HTMLDivElement
  private guideDistance: HTMLDivElement
  private focusHint: HTMLDivElement
  private backBtn: HTMLButtonElement
  private hintBtn: HTMLButtonElement
  private toastEl: HTMLDivElement
  private hintTimer = 0

  onBack: () => void = () => {}
  onHint: () => void = () => {}
  onPrompt: () => void = () => {}

  constructor(root: HTMLElement) {
    this.root = root

    this.crosshair = el('div', 'crosshair')
    this.prompt = el('div', 'prompt')
    // Tap works too (touch): the prompt is clickable only while shown (CSS gives
    // .prompt.show pointer-events:auto; hidden it must not intercept the canvas).
    this.prompt.style.cursor = 'pointer'
    this.prompt.addEventListener('click', () => this.onPrompt())
    this.focusHint = el('div', 'focus-hint')

    this.list = el('div', 'tasklist')
    this.list.innerHTML = `<h2>Moving in</h2>`
    this.listUl = document.createElement('ul')
    this.list.appendChild(this.listUl)

    this.guide = el('div', 'guide')
    this.guideArrow = el('div', 'guide-arrow')
    const guideCopy = el('div', 'guide-copy')
    this.guideTitle = el('div', 'guide-title')
    this.guideDistance = el('div', 'guide-distance')
    guideCopy.append(this.guideTitle, this.guideDistance)
    this.guide.append(this.guideArrow, guideCopy)

    this.backBtn = el('button', 'pill-btn btn-back') as HTMLButtonElement
    this.backBtn.textContent = '‹ Step back'
    this.backBtn.style.display = 'none'
    this.backBtn.addEventListener('click', () => this.onBack())

    this.hintBtn = el('button', 'pill-btn btn-hint') as HTMLButtonElement
    this.hintBtn.textContent = 'Need a hint?'
    this.hintBtn.style.display = 'none'
    this.hintBtn.addEventListener('click', () => this.onHint())

    this.toastEl = el('div', 'toast')

    this.root.append(
      this.crosshair,
      this.prompt,
      this.list,
      this.guide,
      this.focusHint,
      this.backBtn,
      this.hintBtn,
      this.toastEl,
    )
  }

  setCrosshairHot(hot: boolean) {
    this.crosshair.classList.toggle('hot', hot)
  }

  showPrompt(html: string | null) {
    if (html) {
      this.prompt.innerHTML = html
      this.prompt.classList.add('show')
    } else {
      this.prompt.classList.remove('show')
    }
  }

  buildTaskList(items: TaskItem[]) {
    this.listUl.innerHTML = ''
    for (const it of items) {
      const li = document.createElement('li')
      li.dataset.id = it.id
      li.innerHTML = `<span class="box">✓</span><span class="label">${it.title}</span>`
      this.listUl.appendChild(li)
    }
    this.updateTaskList(items)
  }

  updateTaskList(items: TaskItem[]) {
    for (const it of items) {
      const li = this.listUl.querySelector<HTMLLIElement>(`li[data-id="${it.id}"]`)
      if (!li) continue
      li.classList.toggle('done', it.done)
      li.classList.toggle('active', it.available && !it.done)
      li.classList.toggle('current', Boolean(it.current) && it.available && !it.done)
      const label = li.querySelector('.label')!
      label.textContent = !it.done && it.note ? `${it.title} ${it.note}` : it.title
    }
  }

  // --- The online furniture shop (the laptop by the front door) ---
  private shopEl: HTMLDivElement | null = null
  onOrder: (id: string) => void = () => {}
  onShopClose: () => void = () => {}

  get shopOpen() {
    return this.shopEl !== null
  }

  openShop(items: ShopEntry[]) {
    if (this.shopEl) return
    const panel = el('div', 'shoppanel show')
    panel.innerHTML = `
      <div class="shop-card">
        <div class="shop-head">
          <div class="shop-brand">settle<span>.home</span></div>
          <div class="shop-tag">everything a house needs — gentle couriers, same-day</div>
        </div>
        <ul class="shop-list"></ul>
        <button class="pill-btn shop-close">Close the laptop</button>
      </div>`
    panel.querySelector('.shop-close')!.addEventListener('click', () => {
      this.closeShop()
      this.onShopClose()
    })
    this.root.appendChild(panel)
    this.shopEl = panel
    this.list.style.display = 'none' // the checklist would only clutter behind the panel
    this.refreshShop(items)
  }

  refreshShop(items: ShopEntry[]) {
    const ul = this.shopEl?.querySelector('.shop-list')
    if (!ul) return
    ul.innerHTML = ''
    for (const it of items) {
      const li = document.createElement('li')
      li.className = `shop-item st-${it.status}`
      const state =
        it.status === 'orderable'
          ? `<button class="order-btn" data-id="${it.id}">Order</button>`
          : it.status === 'shipping'
            ? `<span class="chip">on its way…</span>`
            : it.status === 'porch'
              ? `<span class="chip gold">on the porch 📦</span>`
              : it.status === 'carrying'
                ? `<span class="chip gold">in your arms</span>`
                : it.status === 'placed'
                  ? `<span class="chip ok">delivered ✓</span>`
                  : `<span class="chip dim">${it.lockNote ?? 'not yet'}</span>`
      li.innerHTML = `<span class="shop-name">${it.name}</span>${state}`
      ul.appendChild(li)
    }
    ul.querySelectorAll<HTMLButtonElement>('.order-btn').forEach((b) =>
      b.addEventListener('click', () => this.onOrder(b.dataset.id!)),
    )
  }

  closeShop() {
    this.shopEl?.remove()
    this.shopEl = null
    this.list.style.display = 'block'
  }

  showGuide(info: GuideInfo | null) {
    if (!info) {
      this.guide.classList.remove('show')
      this.guide.removeAttribute('aria-label')
      return
    }
    const distance = info.distance.toFixed(info.distance < 10 ? 1 : 0)
    this.guideTitle.textContent = info.title
    this.guideDistance.textContent = `${distance} m away`
    this.guide.setAttribute('aria-label', `${info.title}, ${distance} metres away`)
    this.guideArrow.style.transform = `rotate(${info.angle}rad)`
    this.guide.classList.add('show')
  }

  setFocusMode(on: boolean) {
    this.backBtn.style.display = on ? 'block' : 'none'
    this.hintBtn.style.display = on ? 'block' : 'none'
    this.crosshair.style.display = on ? 'none' : 'block'
    this.list.style.display = on ? 'none' : 'block'
    this.showGuide(null)
    if (!on) this.focusHint.classList.remove('show')
  }

  setFocusHint(text: string) {
    this.focusHint.textContent = text
    this.focusHint.classList.add('show')
  }

  // Briefly emphasise a corrective hint, then fall back to the standing one.
  flashFocusHint(text: string, standing: string) {
    this.setFocusHint(text)
    this.hintTimer = window.setTimeout(() => this.setFocusHint(standing), 2200)
  }

  clearFlash() {
    clearTimeout(this.hintTimer)
  }

  toast(text: string, ms = 2600) {
    this.toastEl.textContent = text
    this.toastEl.classList.add('show')
    window.setTimeout(() => this.toastEl.classList.remove('show'), ms)
  }

  // Scratch-to-reveal hint card (A Little to the Left's signature help). A pencil
  // sketch of the advice sits under a scribble layer the player rubs away.
  showHintCard(text: string) {
    const overlay = el('div', 'hintcard show')
    const frame = el('div', 'frame')
    const w = 320
    const h = 240
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    // underlayer: paper + advice sketch
    ctx.fillStyle = '#f6ecdd'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#c98964'
    ctx.lineWidth = 2
    ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.fillStyle = '#5c3b48'
    ctx.font = "600 17px 'Trebuchet MS', sans-serif"
    wrapText(ctx, text, 30, 60, w - 60, 24)
    ctx.font = "italic 13px 'Trebuchet MS', sans-serif"
    ctx.fillStyle = '#8a6b74'
    ctx.fillText('— rub to reveal —', 30, h - 34)

    // overlay scribble on a second canvas we composite via destination-out
    const scratch = document.createElement('canvas')
    scratch.width = w
    scratch.height = h
    const sctx = scratch.getContext('2d')!
    sctx.fillStyle = '#b79a86'
    sctx.fillRect(0, 0, w, h)
    sctx.strokeStyle = '#a98b76'
    sctx.lineWidth = 3
    for (let i = 0; i < 260; i++) {
      sctx.beginPath()
      sctx.moveTo(Math.random() * w, Math.random() * h)
      sctx.lineTo(Math.random() * w, Math.random() * h)
      sctx.stroke()
    }

    // Two layered canvases: the paper+advice underneath, the scribble on top.
    canvas.style.position = 'relative'
    canvas.style.display = 'block'
    scratch.style.position = 'absolute'
    scratch.style.left = '0'
    scratch.style.top = '0'
    scratch.style.borderRadius = '4px'
    scratch.style.touchAction = 'none'

    let rubbing = false
    const rub = (e: PointerEvent) => {
      if (!rubbing) return
      const r = scratch.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      sctx.globalCompositeOperation = 'destination-out'
      sctx.beginPath()
      sctx.arc(x, y, 20, 0, Math.PI * 2)
      sctx.fill()
    }
    scratch.addEventListener('pointerdown', (e) => {
      rubbing = true
      rub(e)
    })
    window.addEventListener('pointermove', rub)
    window.addEventListener('pointerup', () => (rubbing = false))

    const close = el('button', 'pill-btn close') as HTMLButtonElement
    close.style.position = 'relative'
    close.textContent = 'Got it'
    close.addEventListener('click', () => {
      window.removeEventListener('pointermove', rub)
      overlay.remove()
    })

    const wrap = document.createElement('div')
    wrap.style.position = 'relative'
    wrap.appendChild(canvas)
    wrap.appendChild(scratch)
    frame.appendChild(wrap)
    const cap = el('div', 'cap')
    cap.textContent = 'Hint'
    frame.appendChild(cap)
    frame.appendChild(close)
    overlay.appendChild(frame)
    this.root.appendChild(overlay)
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = className
  return e
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy)
      line = word + ' '
      yy += lh
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, yy)
}
