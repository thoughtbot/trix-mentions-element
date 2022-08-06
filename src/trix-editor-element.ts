export type TrixAttachment = any
export type TrixDocument = {toString(): string}
export type TrixEditor = {
  deleteInDirection(direction: 'backward'): void
  insertAttachment(attachment: TrixAttachment): void
  getDocument(): TrixDocument
  getPosition(): number
  setSelectedRange(range: number | [number] | [number, number]): void
}
export type TrixEditorElement = HTMLElement & {editor: TrixEditor}

export interface TrixEditorInput {
  element: TrixEditorElement
  editor: TrixEditor
  value: string

  selectionEnd: number

  focus(options?: FocusOptions): void

  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

export class TrixEditorElementAdapter implements TrixEditorInput {
  readonly element: TrixEditorElement

  constructor(element: TrixEditorElement) {
    this.element = element
  }

  focus(options?: FocusOptions): void {
    this.element.focus(options)
  }

  removeAttribute(name: string): void {
    this.element.removeAttribute(name)
  }

  setAttribute(name: string, value: string): void {
    this.element.setAttribute(name, value)
  }

  get selectionEnd(): number {
    return this.editor.getPosition() + 1
  }

  get value(): string {
    return valueOf(this.element)
  }

  get editor(): TrixEditor {
    return this.element.editor
  }
}

declare global {
  const Trix: {
    Attachment: TrixAttachment
  }
}

function getJSONAttribute(element: HTMLElement, key: string): any {
  try {
    const value = element.getAttribute(key)
    JSON.parse(value || '{}')
  } catch {
    return {}
  }
}

function extractDataAttribute(dataset: DOMStringMap, key: string, prefix: string): [string, string | undefined] {
  const value = dataset[key]
  const unprefixed = key.replace(prefix, '')
  const firstCharacter = unprefixed[0]
  const rest = unprefixed.substring(1)
  const name = firstCharacter.toLowerCase() + rest

  return [name, value]
}

export function valueOf(element: TrixEditorElement): string {
  return element.editor.getDocument().toString()
}

export function buildTrixAttachment(elementOrOptions: HTMLElement | Record<string, any>): TrixAttachment | null {
  const attribute = 'data-trix-attachment'
  const prefix = 'trixAttachment'

  if (elementOrOptions instanceof HTMLElement) {
    const element = elementOrOptions

    const defaults = {content: element.innerHTML}
    const options = getJSONAttribute(element, attribute)
    const overrides: Record<string, any> = {}

    const {dataset} = element
    for (const key in dataset) {
      if (key.startsWith(prefix) && key !== prefix) {
        const [name, value] = extractDataAttribute(dataset, key, prefix)
        overrides[name] = value
      }
    }

    return new Trix.Attachment({...defaults, ...options, ...overrides})
  } else if (elementOrOptions) {
    const options = elementOrOptions

    return new Trix.Attachment(options)
  } else {
    return null
  }
}

export function assertTrixEditorElement(element: Element | null): asserts element is TrixEditorElement {
  if (element && element.localName === 'trix-editor') return

  throw new Error('Only trix-editor elements are supported')
}
