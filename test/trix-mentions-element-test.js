import {WrapperComponent} from './wrapper-component'

describe('trix-mentions element', function () {
  afterEach(function () {
    document.body.innerHTML = ''
  })

  describe('element creation', function () {
    it('creates from document.createElement', function () {
      const el = document.createElement('trix-mentions')
      assert.equal('TRIX-MENTIONS', el.nodeName)
      assert(el instanceof window.TrixMentionsElement)
    })

    it('creates from constructor', function () {
      const el = new window.TrixMentionsElement()
      assert.equal('TRIX-MENTIONS', el.nodeName)
    })
  })

  describe('after tree insertion', function () {
    beforeEach(function () {
      document.body.innerHTML = `
        <trix-mentions keys=": @ [[">
          <trix-editor></trix-editor>
        </trix-mentions>
      `
    })

    it('has activation keys', function () {
      const expander = document.querySelector('trix-mentions')
      assert.deepEqual(
        [
          {key: ':', multiWord: false},
          {key: '@', multiWord: false},
          {key: '[[', multiWord: false}
        ],
        expander.keys
      )
    })

    it('dispatches change event', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const result = once(expander, 'trix-mentions-change')
      triggerInput(input, ':')
      const event = await result
      const {key} = event.detail
      assert.equal(':', key)
    })

    it('dismisses the menu when dismiss() is called', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const menu = document.createElement('ul')
      menu.appendChild(document.createElement('li'))

      expander.addEventListener('trix-mentions-change', event => {
        const {provide} = event.detail
        provide(Promise.resolve({matched: true, fragment: menu}))
      })

      input.focus()
      triggerInput(input, ':')
      await waitForAnimationFrame()
      assert.exists(expander.querySelector('ul'))

      expander.dismiss()
      await waitForAnimationFrame()
      assert.isNull(expander.querySelector('ul'))
    })

    it('dispatches change events for 2 char activation keys', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')

      const receivedText = []
      const expectedText = ['', 'a', 'ab', 'abc', 'abcd']

      expander.addEventListener('trix-mentions-change', event => {
        const {key, text} = event.detail
        assert.equal('[[', key)
        receivedText.push(text)
      })
      triggerInput(input, '[[')
      triggerInput(input, '[[a')
      triggerInput(input, '[[ab')
      triggerInput(input, '[[abc')
      triggerInput(input, '[[abcd')

      assert.deepEqual(receivedText, expectedText)
    })

    it('toggles the [role] and [aria-multiline] when expanding and dismissing the menu', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const menu = document.createElement('ul')
      menu.appendChild(document.createElement('li'))

      expander.addEventListener('trix-mentions-change', event => {
        const {provide} = event.detail
        provide(Promise.resolve({matched: true, fragment: menu}))
      })

      input.focus()
      triggerInput(input, ':')
      await waitForAnimationFrame()
      assert.equal(input.getAttribute('role'), 'combobox')
      assert.equal(input.getAttribute('aria-multiline'), 'false')

      expander.dismiss()
      await waitForAnimationFrame()
      assert.equal(input.getAttribute('role'), 'textbox')
      assert.equal(input.getAttribute('aria-multiline'), null)
    })

    describe('committing', function () {
      beforeEach(function () {
        document.body.innerHTML = `
          <trix-mentions keys="#">
            <trix-editor></trix-editor>
            <ul role="listbox" hidden>
              <li id="option-1" role="option">an option</li>
            </ul>
          </trix-mentions>`
      })

      it('forwards the [data-trix-attachment] attribute to the Trix.Attachment instance without a trix-mentions-value listener', async function () {
        const attachmentOptions = {contentType: 'ignored', sgid: 'a-hash'}
        const expander = document.querySelector('trix-mentions')
        const input = expander.querySelector('trix-editor')
        const menu = document.querySelector('ul')
        const item = document.querySelector('li')
        item.setAttribute('data-trix-attachment', JSON.stringify(attachmentOptions))
        item.setAttribute('data-ignored-attribute', 'ignored')
        item.setAttribute('data-trix-attachment-content-type', 'mime')
        menu.appendChild(item)

        expander.addEventListener('trix-mentions-change', event => {
          const {provide} = event.detail
          provide(Promise.resolve({matched: true, fragment: menu}))
        })

        input.focus()
        triggerInput(input, '#')
        await waitForAnimationFrame()

        item.click()
        await waitForAnimationFrame()

        const figure = input.querySelector('figure')
        const {content, contentType, sgid} = JSON.parse(figure.getAttribute('data-trix-attachment'))
        assert.equal(sgid, 'a-hash')
        assert.equal(item.textContent, content)
        assert.equal('mime', contentType)
        assert.equal('mime', figure.getAttribute('data-trix-content-type'))
        assert(figure.textContent.includes(item.textContent))
      })

      it('advances the cursor to after the attachment content', async function () {
        const expander = document.querySelector('trix-mentions')
        const input = expander.querySelector('trix-editor')
        const menu = document.querySelector('ul')
        menu.insertAdjacentHTML('beforeend', '<li id="option-2" role="option">another option</li>')
        const option1 = document.querySelector('li:nth-of-type(1)')
        const option2 = document.querySelector('li:nth-of-type(2)')

        expander.addEventListener('trix-mentions-change', ({detail: {provide}}) => {
          provide(Promise.resolve({matched: true, fragment: menu}))
        })

        input.focus()
        triggerInput(input, '#', true)
        await waitForAnimationFrame()

        assert.equal(option1.getAttribute('aria-selected'), 'true')
        assert.equal(option2.getAttribute('aria-selected'), 'false')

        triggerKeydown(input, 'ArrowDown')
        await waitForAnimationFrame()

        assert.equal(option1.getAttribute('aria-selected'), 'false')
        assert.equal(option2.getAttribute('aria-selected'), 'true')

        triggerInput(input, 'z', true)
        await waitForAnimationFrame()
        option1.click()
        await waitForAnimationFrame()

        const value = input.editor.getDocument()
        assert.equal(value.toString().includes('z'), false)
      })
    })
  })

  describe('multi-word scenarios', function () {
    beforeEach(function () {
      document.body.innerHTML = `
        <trix-mentions keys="@ # [[" multiword="# [[">
          <trix-editor></trix-editor>
        </trix-mentions>`
    })

    it('has activation keys', function () {
      const expander = document.querySelector('trix-mentions')
      assert.deepEqual(
        [
          {key: '@', multiWord: false},
          {key: '#', multiWord: true},
          {key: '[[', multiWord: true}
        ],
        expander.keys
      )
    })

    it('dispatches change event for multi-word', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const result = once(expander, 'trix-mentions-change')
      triggerInput(input, '@match #some text')
      const event = await result
      const {key, text} = event.detail
      assert.equal('#', key)
      assert.equal('some text', text)
    })

    it('dispatches change events for 2 char activation keys for multi-word', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')

      const receivedText = []
      const expectedText = ['', 'a', 'ab', 'abc', 'abcd', 'abcd def']

      expander.addEventListener('trix-mentions-change', event => {
        const {key, text} = event.detail
        assert.equal('[[', key)
        receivedText.push(text)
      })
      triggerInput(input, '[[')
      triggerInput(input, '[[a')
      triggerInput(input, '[[ab')
      triggerInput(input, '[[abc')
      triggerInput(input, '[[abcd')
      triggerInput(input, '[[abcd def')

      assert.deepEqual(receivedText, expectedText)
    })

    it('dispatches change event for single word match after multi-word', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const result = once(expander, 'trix-mentions-change')
      triggerInput(input, '#some text @match')
      const event = await result
      const {key, text} = event.detail
      assert.equal('@', key)
      assert.equal('match', text)
    })

    it('dispatches change event for multi-word with single word inside', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const result = once(expander, 'trix-mentions-change')
      triggerInput(input, '#some text @match word')
      const event = await result
      const {key, text} = event.detail
      assert.equal('#', key)
      assert.equal('some text @match word', text)
    })

    it('dispatches change event for the first activation key even if it is typed again', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')

      let result = once(expander, 'trix-mentions-change')
      triggerInput(input, '#step 1')
      let event = await result
      let {key, text} = event.detail
      assert.equal('#', key)
      assert.equal('step 1', text)

      await waitForAnimationFrame()

      result = once(expander, 'trix-mentions-change')
      triggerInput(input, ' #step 2', true) //<-- At this point the text inside the input field is "#step 1 #step 2"
      event = await result
      ;({key, text} = event.detail)
      assert.equal('#', key)
      assert.equal('step 1 #step 2', text)

      await waitForAnimationFrame()

      result = once(expander, 'trix-mentions-change')
      triggerInput(input, ' #step 3', true) //<-- At this point the text inside the input field is "#step 1 #step 2 #step 3"
      event = await result
      ;({key, text} = event.detail)
      assert.equal('#', key)
      assert.equal('step 1 #step 2 #step 3', text)
    })
  })

  describe('when the menu is already connected to the document', function () {
    beforeEach(function () {
      document.body.innerHTML = `
        <trix-mentions keys=":">
          <trix-editor></trix-editor>
          <ul role="listbox" hidden>
            <li role="option">an option</li>
          </ul>
        </trix-mentions>`
    })

    it('toggles the visibility when activated and deactivated', async function () {
      const expander = document.querySelector('trix-mentions')
      const input = expander.querySelector('trix-editor')
      const menu = expander.querySelector('ul')
      const item = expander.querySelector('li')

      expander.addEventListener('trix-mentions-change', ({detail: {provide}}) => {
        provide(Promise.resolve({matched: true, fragment: menu}))
      })

      input.focus()
      triggerInput(input, ':')
      await waitForAnimationFrame()

      assert(menu.isConnected)
      assert.deepEqual([menu], Array.from(expander.querySelectorAll('ul')))
      assert.equal(false, menu.hidden)

      item.click()
      await waitForAnimationFrame()

      assert(menu.isConnected)
      assert.equal(expander, menu.parentElement)
      assert.equal(true, menu.hidden)
    })
  })

  describe('driving a turbo-frame', function () {
    it('merges its [name] and text into its [src] attribute, then writes it to the turbo-frame[src]', async function () {
      document.body.innerHTML = `
        <trix-mentions keys=":" name="query" src="/path" data-turbo-frame="menu">
          <trix-editor></trix-editor>
        </trix-mentions>
        <turbo-frame id="menu" role="listbox" hidden></turbo-frame>
      `
      const expander = document.querySelector('trix-mentions')
      const input = document.querySelector('trix-editor')
      const frame = document.querySelector('turbo-frame')
      triggerInput(input, ':a')
      await waitForAnimationFrame()

      assert.equal(expandURL(frame.getAttribute('src')), expandURL('/path?query=a'))
      assert.equal(expandURL(expander.getAttribute('src')), expandURL('/path'))
    })

    it('writes its [name] and text to the turbo-frame[src]', async function () {
      document.body.innerHTML = `
        <trix-mentions keys=":" name="query" data-turbo-frame="menu">
          <trix-editor></trix-editor>
        </trix-mentions>
        <turbo-frame id="menu" src="/path?c=d" role="listbox" hidden></turbo-frame>
      `
      const expander = document.querySelector('trix-mentions')
      const input = document.querySelector('trix-editor')
      const frame = document.querySelector('turbo-frame')
      triggerInput(input, ':a')
      await waitForAnimationFrame()

      assert.equal(expandURL(frame.getAttribute('src')), expandURL('/path?c=d&query=a'))
      assert.equal(expandURL(expander.getAttribute('src')), null)
    })

    it('does not drive a turbo-frame[disabled]', async function () {
      document.body.innerHTML = `
        <trix-mentions keys=":" name="query" data-turbo-frame="menu">
          <trix-editor></trix-editor>
        </trix-mentions>
        <turbo-frame id="menu" src="/path" role="listbox" hidden disabled></turbo-frame>
      `
      const input = document.querySelector('trix-editor')
      const frame = document.querySelector('turbo-frame')
      triggerInput(input, ':a')
      await waitForAnimationFrame()

      assert.equal(frame.getAttribute('src'), '/path')
      assert(frame.hasAttribute('disabled'))
      assert(frame.hidden)
    })
  })

  describe('use inside a ShadowDOM', function () {
    before(function () {
      customElements.define('wrapper-component', WrapperComponent)
    })

    beforeEach(function () {
      document.body.innerHTML = '<wrapper-component></wrapper-component>'
    })

    it('show results on input', async function () {
      const component = document.querySelector('wrapper-component')
      const input = component.shadowRoot.querySelector('trix-editor')
      input.focus()
      triggerInput(input, '@a')
      await waitForAnimationFrame()
      assert.exists(component.shadowRoot.querySelector('ul'))
    })
  })
})

function once(element, eventName) {
  return new Promise(resolve => {
    element.addEventListener(eventName, resolve, {once: true})
  })
}

function triggerInput(input, value, onlyAppend = false) {
  const editor = input.editor
  const selectionEnd = editor.getPosition()
  const selectedRange = onlyAppend ? selectionEnd : [0, selectionEnd]

  editor.setSelectedRange(selectedRange)
  editor.insertString(value)

  return input.dispatchEvent(new InputEvent('input'))
}

function triggerKeydown(element, key) {
  return element.dispatchEvent(new KeyboardEvent('keydown', {key}))
}

async function waitForAnimationFrame() {
  return new Promise(resolve => {
    window.requestAnimationFrame(resolve)
  })
}

function expandURL(pathnameOrURL) {
  if (pathnameOrURL === null || typeof pathnameOrURL === 'undefined') {
    return null
  } else {
    const url = new URL(pathnameOrURL, document.baseURI)

    return url.toString()
  }
}
