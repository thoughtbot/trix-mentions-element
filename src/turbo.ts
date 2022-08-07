export type FrameElement = HTMLElement & {
  loaded: Promise<void> | null
}

export function getFrameElementById(id: string | null): FrameElement | null {
  return document.querySelector<FrameElement>(`turbo-frame#${id}:not([disabled])`)
}

export async function setSearchParam(element: FrameElement, name: string, value: string): Promise<void> {
  const src = element.getAttribute('src') || ''
  const url = new URL(src, element.baseURI)
  url.searchParams.set(name, value)
  element.setAttribute('src', url.toString())

  return element.loaded || Promise.resolve()
}
