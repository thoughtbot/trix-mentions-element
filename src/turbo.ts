export type FrameElement = HTMLElement & {
  loaded: Promise<void> | null
}

export function getFrameElementById(id: string | null): FrameElement | null {
  return document.querySelector<FrameElement>(`turbo-frame#${id}:not([disabled])`)
}

export async function setSearchParam(element: FrameElement, src: string, name: string, value: string): Promise<URL> {
  const url = new URL(src, element.baseURI)
  url.searchParams.set(name, value)
  element.setAttribute('src', url.toString())

  await (element.loaded || Promise.resolve())

  return url
}
