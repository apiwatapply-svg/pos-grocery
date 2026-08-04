import type { ReactNode } from 'react'
import type { SearchableDropdownOption } from './SearchableDropdown'

/**
 * Wraps the substring of `text` that matches `query` in a <mark> for
 * highlighting. The match is case-insensitive and uses the first
 * occurrence. Returns the original text when query is empty.
 */
export function highlightMatch(text: string, query: string): ReactNode {
  const normalized = query.trim()
  if (!normalized) {
    return text
  }
  const lowerText = text.toLowerCase()
  const lowerQuery = normalized.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)
  if (index < 0) {
    return text
  }
  const before = text.slice(0, index)
  const match = text.slice(index, index + normalized.length)
  const after = text.slice(index + normalized.length)
  return (
    <>
      {before}
      <mark className="dropdown-highlight">{match}</mark>
      {after}
    </>
  )
}

type RenderHelpers = {
  query: string
  isActive: boolean
  isExact: boolean
}

/**
 * Default option renderer used by SearchableDropdown. Renders
 * leading (e.g. product image), body (label + description), and
 * trailing (e.g. price) in a flex row. Exported so parent pages
 * can build a custom renderer that falls back to the same look.
 */
export function defaultRenderOption(
  option: SearchableDropdownOption,
  helpers: RenderHelpers,
): ReactNode {
  return (
    <div className="dropdown-option-row">
      {option.leading ? <span className="dropdown-option-leading">{option.leading}</span> : null}
      <div className="dropdown-option-body">
        <div className="dropdown-option-label">
          {highlightMatch(option.label, helpers.query)}
          {helpers.isExact ? <span className="dropdown-exact-tag">ตรง</span> : null}
        </div>
        {option.description ? (
          <div className="dropdown-option-description">
            {highlightMatch(option.description, helpers.query)}
          </div>
        ) : null}
      </div>
      {option.trailing ? <span className="dropdown-option-trailing">{option.trailing}</span> : null}
    </div>
  )
}
