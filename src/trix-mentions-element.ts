import Combobox from '@github/combobox-nav'
import query from './query'
import textFieldSelectionPosition from './text-field-selection-position'
import {
  TrixEditorInput,
  TrixEditorElementAdapter,
  assertTrixEditorElement,
  buildTrixAttachment
} from './trix-editor-element'
import {getFrameElementById, setSearchParam} from './turbo'

type Match = {
  text: string
  key: string
  position: number
}

type Result = {
  fragment: HTMLElement
  matched: boolean
}

type Key = {
  key: string
  multiWord: boolean
}

const states = new WeakMap()

class TrixMentionsExpander {
  expander: TrixMentionsElement
  menu: [HTMLElement, boolean] | null
  oninput: (event: Event) => void
  onkeydown: (event: KeyboardEvent) => void
  onpaste: (event: Event) => void
  oncommit: (event: Event) => void
  onblur: (event: Event) => void
  onmousedown: (event: Event) => void
  combobox: Combobox | null
  match: Match | null
  justPasted: boolean
  lookBackIndex: number
  interactingWithList: boolean

  constructor(expander: TrixMentionsElement) {
    this.expander = expander
    this.combobox = null
    this.menu = null
    this.match = null
    this.justPasted = false
    this.lookBackIndex = 0
    this.oninput = this.onInput.bind(this)
    this.onpaste = this.onPaste.bind(this)
    this.onkeydown = this.onKeydown.bind(this)
    this.oncommit = this.onCommit.bind(this)
    this.onmousedown = this.onMousedown.bind(this)
    this.onblur = this.onBlur.bind(this)
    this.interactingWithList = false
    expander.addEventListener('paste', this.onpaste)
    expander.addEventListener('input', this.oninput, {capture: true})
    expander.addEventListener('keydown', this.onkeydown)
    expander.addEventListener('focusout', this.onblur)
  }

  get input(): TrixEditorInput {
    const input = this.expander.querySelector('trix-editor')
    assertTrixEditorElement(input)

    return new TrixEditorElementAdapter(input)
  }

  destroy() {
    this.expander.removeEventListener('paste', this.onpaste)
    this.expander.removeEventListener('input', this.oninput, {capture: true})
    this.expander.removeEventListener('keydown', this.onkeydown)
    this.expander.removeEventListener('focusout', this.onblur)
  }

  dismissMenu() {
    if (this.deactivate()) {
      this.lookBackIndex = this.input.selectionEnd || this.lookBackIndex
    }
  }

  private activate(match: Match, menu: HTMLElement) {
    if (
      this.input.element !== document.activeElement &&
      this.input.element !== document.activeElement?.shadowRoot?.activeElement
    ) {
      return
    }

    this.deactivate()
    this.menu = [menu, menu.isConnected]

    if (!menu.id) menu.id = `trix-mentions-${Math.floor(Math.random() * 100000).toString()}`
    if (menu.isConnected) {
      menu.hidden = false
    } else {
      this.expander.append(menu)
    }
    this.combobox = new Combobox((this.input.element as unknown) as HTMLTextAreaElement, menu)
    this.input.setAttribute('role', 'combobox')
    this.input.setAttribute('aria-multiline', 'false')

    const {bottom, left} = textFieldSelectionPosition(this.input.element, match.position)
    menu.style.top = `${bottom}px`
    menu.style.left = `${left}px`

    this.combobox.start()
    menu.addEventListener('combobox-commit', this.oncommit)
    menu.addEventListener('mousedown', this.onmousedown)

    // Focus first menu item.
    this.combobox.navigate(1)
  }

  private deactivate() {
    if (!this.menu || !this.combobox) return false

    const [menu, isConnected] = this.menu
    this.menu = null

    menu.removeEventListener('combobox-commit', this.oncommit)
    menu.removeEventListener('mousedown', this.onmousedown)

    this.combobox.destroy()
    this.combobox = null
    this.input.removeAttribute('aria-multiline')
    this.input.setAttribute('role', 'textbox')
    if (isConnected) {
      menu.hidden = true
    } else {
      menu.remove()
    }

    return true
  }

  private onCommit({target}: Event) {
    const item = target
    if (!(item instanceof HTMLElement)) return
    if (!this.combobox) return

    const match = this.match
    if (!match) return

    const selectionStart = match.position - match.key.length
    const selectionEnd = match.position + match.text.length

    const detail = {item, key: match.key, value: null}
    const canceled = !this.expander.dispatchEvent(new CustomEvent('trix-mentions-value', {cancelable: true, detail}))
    if (canceled) return

    const attachment = buildTrixAttachment(detail.value || item)
    if (!attachment) return

    this.input.editor.setSelectedRange([selectionStart, selectionEnd])
    this.input.editor.deleteInDirection('backward')
    this.input.editor.insertAttachment(attachment)

    const cursor = this.input.selectionEnd

    this.deactivate()
    this.input.focus({
      preventScroll: true
    })

    this.lookBackIndex = cursor
    this.match = null
  }

  private onBlur({target}: Event) {
    if (target !== this.input.element) return
    if (this.interactingWithList) {
      this.interactingWithList = false
      return
    }

    this.deactivate()
  }

  private onPaste({target}: Event) {
    if (target !== this.input.element) return
    this.justPasted = true
  }

  async onInput({target}: Event) {
    if (target !== this.input.element) return
    if (this.justPasted) {
      this.justPasted = false
      return
    }

    const match = this.findMatch()
    if (match) {
      this.match = match
      const menu = await this.notifyProviders(match)

      // Text was cleared while waiting on async providers.
      if (!this.match) return

      if (menu) {
        this.activate(match, menu)
      } else {
        this.deactivate()
      }
    } else {
      this.match = null
      this.deactivate()
    }
  }

  findMatch(): Match | void {
    const cursor = this.input.selectionEnd || 0
    const text = this.input.value.replace(/\n+$/, '')
    if (cursor <= this.lookBackIndex) {
      this.lookBackIndex = cursor - 1
    }
    for (const {key, multiWord} of this.expander.keys) {
      const found = query(text, key, cursor, {
        multiWord,
        lookBackIndex: this.lookBackIndex,
        lastMatchPosition: this.match ? this.match.position : null
      })
      if (found) {
        return {text: found.text, key, position: found.position}
      }
    }
  }

  async notifyProviders(match: Match): Promise<HTMLElement | void> {
    const providers: Array<Promise<Result> | Result> = []
    const provide = (result: Promise<Result> | Result) => providers.push(result)
    const canceled = !this.expander.dispatchEvent(
      new CustomEvent('trix-mentions-change', {cancelable: true, detail: {provide, text: match.text, key: match.key}})
    )
    if (canceled) return

    if (providers.length > 0) {
      const all = await Promise.all(providers)
      const fragments = all.filter(x => x.matched).map(x => x.fragment)
      return fragments[0]
    } else {
      return this.driveTurboFrame(match)
    }
  }

  private onMousedown() {
    this.interactingWithList = true
  }

  private onKeydown(event: KeyboardEvent) {
    if (event.target !== this.input.element) return
    if (event.key === 'Escape') {
      this.match = null
      if (this.deactivate()) {
        this.lookBackIndex = this.input.selectionEnd || this.lookBackIndex
        event.stopImmediatePropagation()
        event.preventDefault()
      }
    }
  }

  private async driveTurboFrame(match: Match): Promise<HTMLElement | void> {
    const name = this.expander.name
    const frame = getFrameElementById(this.expander.getAttribute('data-turbo-frame'))

    if (name && frame) {
      await setSearchParam(frame, name, match.text)

      if (frame.childElementCount > 0) {
        return frame
      }
    }
  }
}
export default class TrixMentionsElement extends HTMLElement {
  get keys(): Key[] {
    const keysAttr = this.getAttribute('keys')
    const keys = keysAttr ? keysAttr.split(' ') : []

    const multiWordAttr = this.getAttribute('multiword')
    const multiWord = multiWordAttr ? multiWordAttr.split(' ') : []
    const globalMultiWord = multiWord.length === 0 && this.hasAttribute('multiword')

    return keys.map(key => ({key, multiWord: globalMultiWord || multiWord.includes(key)}))
  }

  get name(): string | null {
    return this.getAttribute('name')
  }

  set name(value: string | null) {
    if (typeof value === 'string') {
      this.setAttribute('name', value)
    } else {
      this.removeAttribute('name')
    }
  }

  connectedCallback(): void {
    const state = new TrixMentionsExpander(this)
    states.set(this, state)
  }

  disconnectedCallback(): void {
    const state: TrixMentionsExpander = states.get(this)
    if (!state) return
    state.destroy()
    states.delete(this)
  }

  dismiss(): void {
    const state: TrixMentionsExpander = states.get(this)
    if (!state) return
    state.dismissMenu()
  }
}
