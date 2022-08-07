# &lt;trix-mentions&gt; element

Activates a suggestion menu to expand text snippets as you type.

Inspired by [@github/text-expander-element][].

[@github/text-expander-element]: https://github.com/github/text-expander-element

## Installation

```
$ npm install --save @thoughtbot/trix-mentions-element
```

## Usage

### Script

Import as ES modules:

```js
import Trix from 'trix'
import '@thoughtbot/trix-mentions-element'

window.Trix = Trix
```

With a script tag:

```html
<script type="module" src="./node_modules/@thoughtbot/trix-mentions-element/dist/bundle.js">
```

### Markup

```html
<trix-mentions keys="@ #" multiword="#">
  <trix-editor></trix-editor>
</trix-mentions>
```

## Attributes

- `keys` is a space separated list of menu activation keys
- `multiword` defines whether the expansion should use several words or not
  - you can provide a space separated list of activation keys that should support multi-word matching

## Events

**`trix-mentions-change`** is fired when a key is matched. In `event.detail` you can find:

- `key`: The matched key; for example: `@`.
- `text`: The matched text; for example: `cat`, for `@cat`.
  - If the `key` is specified in the `multiword` attribute then the matched text can contain multiple words; for example `cat and dog` for `@cat and dog`.
- `provide`: A function to be called when you have the menu results. Takes a `Promise` with `{matched: boolean, fragment: HTMLElement}` where `matched` tells the element whether a suggestion is available, and `fragment` is the menu content to be displayed on the page.

```js
const expander = document.querySelector('trix-mentions')

expander.addEventListener('trix-mentions-change', function(event) {
  const {key, provide, text} = event.detail
  if (key !== '@') return

  const suggestions = document.querySelector('.emoji-suggestions').cloneNode(true)
  suggestions.hidden = false
  for (const suggestion of suggestions.children) {
    if (!suggestion.textContent.match(text)) {
      suggestion.remove()
    }
  }
  provide(Promise.resolve({matched: suggestions.childElementCount > 0, fragment: suggestions}))
})
```

The returned fragment should be consisted of filtered `[role=option]` items to
be selected. Any attribute whose name it prefixed by `data-trix-attachment-`
will transformed into camelCase and used to create a [Trix.Attachment][]
instance under the hood. For example:

```html
<ul class="emoji-suggestions" hidden>
  <li role="option" data-trix-attachment-content="🐈"
                    data-trix-attachment-content-type="application/vnd.my-application.mention">
    🐈 @cat2
  </li>
  <li role="option" data-trix-attachment-content="🐕"
                    data-trix-attachment-content-type="application/vnd.my-application.mention">
    🐕 @dog
  </li>
</ul>
```

Alternatively, `Trix.Attachment` options can be serialized into a JSON object
and encoded into a single `[data-trix-attchment]` attribute. Additional
`data-trix-attachment-` prefixed attributes will be merged in as overrides.

When the `Trix.Attachment` options are missing a `content` key, the selected
`[role="option"]` element's [innerHTML][] will serve as the `content:` value.

[Trix.Attachment]: https://github.com/basecamp/trix/tree/1.3.1#inserting-a-content-attachment
[innerHTML]: https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML

**`trix-mentions-value`** is fired when an item is selected. In `event.detail` you can find:

- `key`: The matched key; for example: `@`.
- `item`: The selected item. This would be one of the `[role=option]`. Use this to work out the `value`.
- `value`: A null value placeholder to replace the query. To replace the query text, re-assign this value.

```js
const expander = document.querySelector('trix-mentions')

expander.addEventListener('trix-mentions-value', function(event) {
  const {key, item}  = event.detail
  if (key === '@') {
    const contentType = item.getAttribute('data-trix-attachment-content-type')
    const content = item.getAttribute('data-trix-attachment-content')

    event.detail.value = {content, contentType}
  }
})
```

Often times, when `[role="option"]` elements encode the `Trix.Attachment`
arguments into their `data-trix-attachment`-prefixed attributes,
`trix-mentions-value` event listeners can be omitted entirely.

## Built-in support for Turbo Frames

All `<trix-mentions>` elements have built-in support for driving
[`<turbo-frame>` elements][turbo-frame].

First, render them with a `[name]` attribute to serve as the query parameter
key, and a `[data-turbo-frame]` attribute that references a `<turbo-frame>`
element with a matching `[id]` attribute:

```html
<trix-mentions key="@" name="query" data-turbo-frame="users">
  <trix-editor></trix-editor>
</trix-mentions>
<turbo-frame id="users" role="listbox" hidden></turbo-frame>
```

Make sure to render the `<turbo-frame>` with the `[hidden]` attribute to start.

Then, whenever a `trix-mentions-change` event is dispatched that bubbles without
any calls to `CustomEvent.detail.provide`, the `<trix-mentions>` element will
merge its current match's text into the into the `<turbo-frame>` element's
`[src]` attribute, using the `[name]` attribute as its key. It'll wait for the
[FrameElement.loaded][] promise to resolve before proceeding. Finally, it'll
manage the `<turbo-frame>` element's `[hidden]` attribute and keep it
synchronized with the visibility of the expanded list of options.

[turbo-frame]: https://turbo.hotwired.dev/handbook/introduction#turbo-frames%3A-decompose-complex-pages
[FrameElement.loaded]: https://turbo.hotwired.dev/reference/frames#properties

## Trix-powered Action Text mentions

Inspired by [Implementing rich-text mentions with Action Text][] by George
Claghorn

The `<trix-mentions>` element integrates with Action Text attachments to embed
server-generated HTML renderings of Active Record instances.

Start with a `User` model:

```ruby
class User < ApplicationRecord
  scope :where_username_like, ->(text) {
    if text.present?
      where("username LIKE ?", text + "%")
    else
      none
    end
  }
end
```

Include the [ActionText::Attachable][] module into the class:

```diff
 class User < ApplicationRecord
+  include ActionText::Attachable
+
   scope :where_username_like, ->(text) {
     if text.present?
       where("username LIKE ?", text + "%")
     else
       none
     end
   }
 end
```

Action Text will generate the HTML for an attached `User` record by rendering
the partial name it returns from its
`User#to_trix_content_attachment_partial_path` method. By default, that method
will return `users/user`.

If you'd like to render a different partial, override it to return a different
path:

```diff
 class User < ApplicationRecord
   include ActionText::Attachable

   scope :where_username_like, ->(text) {
     if text.present?
       where("username LIKE ?", text + "%")
     else
       none
     end
   }
+
+  def to_trix_content_attachment_partial_path
+    "users/trix_content_attachment"
+  end
 end
```

Then, declare the partial's template:

```erb
<%# app/views/users/_trix_content_attachment.html.erb %>
<span>@<%= user.username %></span>
```

The record instance will be available under a key that matches its class name.
In this case, `user`:

Next, render the `<trix-mentions>`. In this example, we'll nest a
`<trix-editor>` element to serve as its input, and a `<turbo-frame>` element to
serve as its listbox:

```erb
<trix-mentions key="@" name="query" data-turbo-frame="users">
  <trix-editor></trix-editor>
  <turbo-frame id="users" role="listbox" hidden>
  </turbo-frame>
<trix-mentions>
```

Within the `<turbo-frame>` element, render a list of `[role="option"]` elements
that match the value of `params[:query]`:

```diff
 <trix-mentions key="@" name="query" data-turbo-frame="users">
   <trix-editor></trix-editor>
   <turbo-frame id="users" role="listbox" hidden>
+    <% User.where_username_like(params[:query]).each do |user| %>
+      <button id="<%= dom_id(user, :mention) %>" type="button" role="option" tabindex="-1">
+        <%= render user.to_trix_content_attachment_partial_path, user: user %>
+     </button>
+    <% end %>
   </turbo-frame>
 <trix-mentions>
```

Then, encode the [`User#attachable_sgid`][attachable_sgid] into the element's
`[data-trix-attachment-sgid]` attribute:

```diff
 <trix-mentions key="@" name="query" data-turbo-frame="users">
   <trix-editor></trix-editor>
   <turbo-frame id="users" role="listbox" hidden>
     <% User.where_username_like(params[:query]).each do |user| %>
-      <button id="<%= dom_id(user, :mention) %>" type="button" role="option" tabindex="-1">
+      <button id="<%= dom_id(user, :mention) %>" type="button" role="option" tabindex="-1"
+              data-trix-attachment-sgid="<%= user.attachable_sgid %>">
         <%= render user.to_trix_content_attachment_partial_path, user: user %>
      </button>
     <% end %>
   </turbo-frame>
 <trix-mentions>
```

If the `Trix.Attachment` instance requires more attributes, you can encode their
values under kebab-case key names with a `data-trix-attachment-` prefix, or as a
single JSON-encoded object under the `[data-trix-attachment]` key:

```diff
 <trix-mentions key="@" name="query" data-turbo-frame="users">
   <trix-editor></trix-editor>
   <turbo-frame id="users" role="listbox" hidden>
     <% User.where_username_like(params[:query]).each do |user| %>
-      <button id="<%= dom_id(user, :mention) %>" type="button" role="option" tabindex="-1">
+      <button id="<%= dom_id(user, :mention) %>" type="button" role="option" tabindex="-1"
+              data-trix-attachment="<%= html_escape { sgid: user.attachable_sgid, content_type: "..." }.to_json %>">
         <%= render user.to_trix_content_attachment_partial_path, user: user %>
      </button>
     <% end %>
   </turbo-frame>
 <trix-mentions>
```

Then, declare a partial template for Action Text to render when it encounters
attached `User` instances. By default, Action Text will attempt to render
`users/user`, but that partial path can be overridden by declaring
`User#to_attachable_partial_path`:

```diff
 class User < ApplicationRecord
   include ActionText::Attachable

   scope :where_username_like, ->(text) {
     if text.present?
       where("username LIKE ?", text + "%")
     else
       none
     end
   }

   def to_trix_content_attachment_partial_path
     "users/trix_content_attachment"
   end

+  def to_atachable_partial_path
+    "users/attachable"
+  end
 end
```

Finally, declare the template to render an attached `User`:

```erb
<%# app/views/users/_attachable.html.erb %>

<%= link_to user do %>
  <%= render user.to_trix_content_attachment_partial_path, user: user %>
<% end %>
```

[ActionText::Attachable]: https://edgeapi.rubyonrails.org/classes/ActionText/Attachable.html
[Implementing rich-text mentions with Action Text]: https://gist.github.com/georgeclaghorn/c83b31a7e378fb07fba0c3d25835e5ba
[attachable_sgid]: https://edgeapi.rubyonrails.org/classes/ActionText/Attachable.html#method-i-attachable_sgid

## Browser support

Browsers without native [custom element support][support] require a [polyfill][].

- Chrome
- Firefox
- Safari
- Microsoft Edge

[support]: https://caniuse.com/#feat=custom-elementsv1
[polyfill]: https://github.com/webcomponents/custom-elements

## Development

```
npm install
npm test
```

## License

Distributed under the MIT license. See LICENSE for details.
