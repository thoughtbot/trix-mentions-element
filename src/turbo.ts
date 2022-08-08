export type FrameElement = HTMLElement & {
  loaded: Promise<void> | null
}

export function getFrameElementById(id: string | null): FrameElement | null {
  return document.querySelector<FrameElement>(`turbo-frame#${id}:not([disabled])`)
}

export function setSearchParam(element: FrameElement, src: string | null, name: string, value: string): Promise<void> {
  const url = new URL(src || element.getAttribute('src') || '', element.baseURI)
  url.searchParams.set(name, value)
  element.setAttribute('src', url.toString())

  return element.loaded || Promise.resolve()
}
