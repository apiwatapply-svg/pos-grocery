import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  forwardRef,
} from 'react'

export type SearchableDropdownOption = {
  /** Unique value used by parent to identify the option. */
  value: string
  /** Text used to filter and render in the dropdown list. */
  label: string
  /** Optional supporting text shown under the label. */
  description?: string
  /** Optional node rendered to the right of the option (e.g. price). */
  trailing?: ReactNode
  /** Optional icon/node rendered to the left of the option. */
  leading?: ReactNode
  /** Optional arbitrary payload available in renderOption / onSelect. */
  data?: unknown
  /** When true, this option is treated as "out of stock" and is disabled. */
  disabled?: boolean
}

export type SearchableDropdownHandle = {
  focus: () => void
  selectAll: () => void
  blur: () => void
}

export type SearchableDropdownProps = {
  /** Current input value (controlled). */
  value: string
  /** Called when the user types into the input. */
  onChange: (value: string) => void
  /** Called when the user picks an option from the list. */
  onSelect?: (option: SearchableDropdownOption) => void
  /** Full option list. */
  options: SearchableDropdownOption[]
  /** Input placeholder. */
  placeholder?: string
  /** Input id. */
  id?: string
  /** Input aria-label. Defaults to placeholder. */
  ariaLabel?: string
  /** Input autoComplete attribute. */
  autoComplete?: string
  /** Disabled state. */
  disabled?: boolean
  /** Optional className added to the root wrapper. */
  className?: string
  /**
   * Custom filter function. Return true to include the option in the
   * dropdown for the given query. Defaults to a case-insensitive substring
   * match against label and description.
   */
  filterOption?: (option: SearchableDropdownOption, query: string) => boolean
  /**
   * Predicate used to detect an "exact" match for the current query.
   * When matched, the option is highlighted as the Enter target.
   */
  isExactMatch?: (option: SearchableDropdownOption, query: string) => boolean
  /**
   * Maximum number of items rendered in the dropdown. Defaults to 50.
   */
  maxOptions?: number
  /**
   * Render an option. Defaults to label + description + trailing.
   */
  renderOption?: (
    option: SearchableDropdownOption,
    helpers: { query: string; isActive: boolean; isExact: boolean },
  ) => ReactNode
  /**
   * Called when the input receives a key event the component did not consume.
   * Useful for parents that need to implement global Enter navigation.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  /**
   * Called when the dropdown opens or closes.
   */
  onOpenChange?: (open: boolean) => void
  /**
   * Force-hide the dropdown even when there are matching options. Useful when
   * the parent has temporarily locked the search (e.g. submit in progress).
   */
  forceClose?: boolean
  /**
   * When true, the input keeps keyboard focus on selection. Defaults to true.
   */
  keepFocusOnSelect?: boolean
  /**
   * Empty-state message. Defaults to "ไม่พบรายการที่ค้นหา".
   */
  emptyMessage?: string
  /**
   * Hint message shown under the input. Useful for scanner hints.
   */
  hint?: ReactNode
}

const DEFAULT_FILTER = (option: SearchableDropdownOption, query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  if (option.label.toLowerCase().includes(normalized)) {
    return true
  }
  if (option.description && option.description.toLowerCase().includes(normalized)) {
    return true
  }
  return false
}

const DEFAULT_EXACT = (option: SearchableDropdownOption, query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return false
  }
  if (option.label.toLowerCase() === normalized) {
    return true
  }
  if (option.description && option.description.toLowerCase() === normalized) {
    return true
  }
  return false
}

function highlightMatch(text: string, query: string): ReactNode {
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

function defaultRenderOption(
  option: SearchableDropdownOption,
  helpers: { query: string; isActive: boolean; isExact: boolean },
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

export const SearchableDropdown = forwardRef<SearchableDropdownHandle, SearchableDropdownProps>(
  function SearchableDropdown(props, ref) {
    const {
      value,
      onChange,
      onSelect,
      options,
      placeholder,
      id,
      ariaLabel,
      autoComplete = 'off',
      disabled = false,
      className,
      filterOption = DEFAULT_FILTER,
      isExactMatch = DEFAULT_EXACT,
      maxOptions = 50,
      renderOption = defaultRenderOption,
      onKeyDown,
      onOpenChange,
      forceClose = false,
      keepFocusOnSelect = true,
      emptyMessage = 'ไม่พบรายการที่ค้นหา',
      hint,
    } = props

    const inputRef = useRef<HTMLInputElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState<number>(-1)
    const [hasUserNavigated, setHasUserNavigated] = useState(false)
    const generatedId = useId()
    const inputId = id ?? `searchable-dropdown-${generatedId}`
    const listboxId = `${inputId}-listbox`
    const optionId = (index: number) => `${inputId}-option-${index}`

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus()
        },
        selectAll: () => {
          inputRef.current?.select()
        },
        blur: () => {
          inputRef.current?.blur()
        },
      }),
      [],
    )

    const filtered = useMemo(() => {
      const visible = options.filter((option) => !option.disabled && filterOption(option, value))
      return visible.slice(0, maxOptions)
    }, [options, filterOption, value, maxOptions])

    const exactIndex = useMemo(() => {
      const trimmed = value.trim()
      if (!trimmed) {
        return -1
      }
      return filtered.findIndex((option) => isExactMatch(option, trimmed))
    }, [filtered, value, isExactMatch])

    // Only show the panel when the user has interacted with the input
    // (typed a query, focused it, or arrowed through the list). This keeps
    // the dropdown from opening on first render and showing every option
    // by default.
    const hasUserQuery = value.trim().length > 0
    const shouldOpen = !forceClose && !disabled && filtered.length > 0 && isOpen && hasUserQuery

    // The active row is whatever the user (or the auto-focus helper) last
    // picked. It is intentionally derived from event handlers rather than
    // re-synced inside an effect so we avoid cascading renders. When the
    // user has not navigated yet, the exact match is the implicit target.
    const resolvedActiveIndex = hasUserNavigated
      ? activeIndex
      : exactIndex >= 0
        ? exactIndex
        : activeIndex < 0 && filtered.length > 0
          ? 0
          : activeIndex

    useEffect(() => {
      onOpenChange?.(shouldOpen)
    }, [shouldOpen, onOpenChange])

    useEffect(() => {
      if (!shouldOpen) {
        return
      }
      const active = listRef.current?.querySelector<HTMLElement>(
        `[data-option-index="${resolvedActiveIndex}"]`,
      )
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' })
      }
    }, [resolvedActiveIndex, shouldOpen])

    const close = useCallback(() => {
      setIsOpen(false)
      setHasUserNavigated(false)
      setActiveIndex(-1)
    }, [])

    const handleDocumentClick = useCallback(
      (event: MouseEvent) => {
        if (!isOpen) {
          return
        }
        const target = event.target
        if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) {
          close()
        }
      },
      [isOpen, close],
    )

    useEffect(() => {
      document.addEventListener('mousedown', handleDocumentClick)
      return () => {
        document.removeEventListener('mousedown', handleDocumentClick)
      }
    }, [handleDocumentClick])

    const selectAt = useCallback(
      (index: number) => {
        const option = filtered[index]
        if (!option) {
          return
        }
        onSelect?.(option)
        if (keepFocusOnSelect) {
          inputRef.current?.focus()
          // Keep caret at end so the user can continue scanning.
          const length = inputRef.current?.value.length ?? 0
          inputRef.current?.setSelectionRange(length, length)
        }
        close()
      },
      [filtered, onSelect, keepFocusOnSelect, close],
    )

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        if (!shouldOpen) {
          setIsOpen(true)
          event.preventDefault()
          return
        }
        event.preventDefault()
        if (filtered.length === 0) {
          return
        }
        setHasUserNavigated(true)
        setActiveIndex((current) => {
          if (current < 0) {
            return exactIndex >= 0 ? exactIndex : 0
          }
          return (current + 1) % filtered.length
        })
        return
      }

      if (event.key === 'ArrowUp') {
        if (!shouldOpen) {
          setIsOpen(true)
          event.preventDefault()
          return
        }
        event.preventDefault()
        if (filtered.length === 0) {
          return
        }
        setHasUserNavigated(true)
        setActiveIndex((current) => {
          if (current < 0) {
            return filtered.length - 1
          }
          return (current - 1 + filtered.length) % filtered.length
        })
        return
      }

      if (event.key === 'Home' && shouldOpen) {
        event.preventDefault()
        setHasUserNavigated(true)
        setActiveIndex(0)
        return
      }

      if (event.key === 'End' && shouldOpen) {
        event.preventDefault()
        setHasUserNavigated(true)
        setActiveIndex(filtered.length - 1)
        return
      }

      if (event.key === 'Escape') {
        if (shouldOpen) {
          event.preventDefault()
          event.stopPropagation()
          close()
          return
        }
      }

      if (event.key === 'Enter') {
        if (shouldOpen && resolvedActiveIndex >= 0 && filtered[resolvedActiveIndex]) {
          event.preventDefault()
          selectAt(resolvedActiveIndex)
          return
        }
      }

      onKeyDown?.(event)
    }

    const wrapperClassName = ['searchable-dropdown', className].filter(Boolean).join(' ')
    const showEmpty = shouldOpen && filtered.length === 0

    const wrapperStyle: CSSProperties = {}

    return (
      <div ref={rootRef} className={wrapperClassName} style={wrapperStyle}>
        <input
          ref={inputRef}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={shouldOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? placeholder}
          aria-activedescendant={
            shouldOpen && resolvedActiveIndex >= 0
              ? optionId(resolvedActiveIndex)
              : undefined
          }
          autoComplete={autoComplete}
          className="searchable-dropdown-input"
          disabled={disabled}
          id={inputId}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (!forceClose && filtered.length > 0) {
              setIsOpen(true)
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {hint ? <div className="searchable-dropdown-hint">{hint}</div> : null}
        {shouldOpen ? (
          <ul
            ref={listRef}
            className="searchable-dropdown-panel"
            id={listboxId}
            role="listbox"
          >
            {filtered.map((option, index) => {
              const isActive = index === resolvedActiveIndex
              const isExact = index === exactIndex
              return (
                <li
                  aria-selected={isActive}
                  className={
                    isActive
                      ? 'searchable-dropdown-option active'
                      : isExact
                        ? 'searchable-dropdown-option exact'
                        : 'searchable-dropdown-option'
                  }
                  data-option-index={index}
                  id={optionId(index)}
                  key={option.value}
                  role="option"
                  onMouseDown={(event) => {
                    // Use mousedown so the input keeps focus.
                    event.preventDefault()
                    selectAt(index)
                  }}
                  onMouseEnter={() => {
                    setHasUserNavigated(true)
                    setActiveIndex(index)
                  }}
                >
                  {renderOption(option, { query: value, isActive, isExact })}
                </li>
              )
            })}
          </ul>
        ) : null}
        {showEmpty ? (
          <div className="searchable-dropdown-empty" role="status">
            {emptyMessage}
          </div>
        ) : null}
      </div>
    )
  },
)
