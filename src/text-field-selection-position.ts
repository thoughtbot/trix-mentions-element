import {TrixEditorElement} from './trix-editor-element'

// Get offset position of cursor in a `textField` field. The offset is the
// number of pixels from the top left of the `textField`. Useful for
// positioning a popup near the insertion point.
//
// const {top, left} = textFieldSelectionPosition(trixEditor)
//
// Measures offset position of cursor in text field.
//
// field - HTMLElement a trix-editor element
// index - Number index into textField.value (default: textField.selectionEnd)
//
// Returns object with {top, left} properties.
export default function textFieldSelectionPosition(field: TrixEditorElement, index: number): DOMRect {
  return field.editor.getClientRectAtPosition(index)
}
