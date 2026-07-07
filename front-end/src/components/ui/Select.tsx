import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  forwardRef,
} from 'react'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SelectHandle = {
  focus: () => void
  blur: () => void
}

export type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  id?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
  required?: boolean
  name?: string
  /** Optional label content shown when no option is selected. */
  emptyLabel?: string
  /**
   * Render an option. Defaults to label.
   */
  renderOption?: (option: SelectOption, isActive: boolean) => ReactNode
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export const Select = forwardRef<SelectHandle, SelectProps>(function Select(props, ref) {
  const {
    value,
    onChange,
    options,
    placeholder = 'เลือกรายการ',
    id,
    ariaLabel,
    disabled = false,
    className,
    required = false,
    name,
    emptyLabel = placeholder,
    renderOption,
    onKeyDown,
  } = props

  const buttonRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const generatedId = useId()
  const selectId = id ?? `select-${generatedId}`
  const listboxId = `${selectId}-listbox`
  const optionId = (index: number) => `${selectId}-option-${index}`

  useImperativeHandle(
    ref,
    () => ({
      focus: () => buttonRef.current?.focus(),
      blur: () => buttonRef.current?.blur(),
    }),
    [],
  )

  const selectedOption = options.find((option) => option.value === value)
  const label = selectedOption ? selectedOption.label : emptyLabel
  const isPlaceholder = !selectedOption

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const currentIndex = options.findIndex((option) => option.value === value)
    if (currentIndex >= 0) {
      setActiveIndex(currentIndex)
    } else {
      const firstEnabled = options.findIndex((option) => !option.disabled)
      setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0)
    }
  }, [isOpen, options, value])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const active = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    )
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, isOpen])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target
      if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [isOpen, close])

  const selectAt = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option || option.disabled) {
        return
      }
      onChange(option.value)
      close()
      buttonRef.current?.focus()
    },
    [options, onChange, close],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (!isOpen) {
        event.preventDefault()
        setIsOpen(true)
        return
      }
    }

    if (event.key === 'ArrowDown' && isOpen) {
      event.preventDefault()
      setActiveIndex((current) => {
        if (current < 0) {
          return options.findIndex((option) => !option.disabled)
        }
        for (let next = current + 1; next < options.length; next += 1) {
          if (!options[next].disabled) {
            return next
          }
        }
        return current
      })
      return
    }

    if (event.key === 'ArrowUp' && isOpen) {
      event.preventDefault()
      setActiveIndex((current) => {
        if (current < 0) {
          return options.length - 1
        }
        for (let next = current - 1; next >= 0; next -= 1) {
          if (!options[next].disabled) {
            return next
          }
        }
        return current
      })
      return
    }

    if (event.key === 'Home' && isOpen) {
      event.preventDefault()
      const first = options.findIndex((option) => !option.disabled)
      setActiveIndex(first >= 0 ? first : 0)
      return
    }

    if (event.key === 'End' && isOpen) {
      event.preventDefault()
      for (let next = options.length - 1; next >= 0; next -= 1) {
        if (!options[next].disabled) {
          setActiveIndex(next)
          break
        }
      }
      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }

    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      selectAt(activeIndex)
      return
    }

    onKeyDown?.(event)
  }

  const wrapperClassName = ['custom-select', className].filter(Boolean).join(' ')

  return (
    <div ref={rootRef} className={wrapperClassName}>
      <button
        ref={buttonRef}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel ?? label}
        aria-required={required || undefined}
        className={isPlaceholder ? 'custom-select-button placeholder' : 'custom-select-button'}
        disabled={disabled}
        id={selectId}
        name={name}
        type="button"
        onClick={() => {
          if (disabled) {
            return
          }
          setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="custom-select-label">{label}</span>
        <span className="custom-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {required && !selectedOption ? (
        <input
          aria-hidden="true"
          name={name ? `${name}-required` : undefined}
          required
          style={{ display: 'none' }}
          tabIndex={-1}
          value=""
          onChange={() => {
            // no-op
          }}
        />
      ) : null}
      {isOpen && !disabled ? (
        <ul
          ref={listRef}
          className="custom-select-panel"
          id={listboxId}
          role="listbox"
        >
          {options.map((option, index) => {
            const isActive = index === activeIndex
            const isSelected = option.value === value
            const className = ['custom-select-option']
            if (isActive) {
              className.push('active')
            }
            if (isSelected) {
              className.push('selected')
            }
            if (option.disabled) {
              className.push('disabled')
            }
            return (
              <li
                aria-disabled={option.disabled || undefined}
                aria-selected={isSelected}
                className={className.join(' ')}
                data-option-index={index}
                id={optionId(index)}
                key={option.value}
                role="option"
                onMouseDown={(event) => {
                  if (option.disabled) {
                    return
                  }
                  event.preventDefault()
                  selectAt(index)
                }}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setActiveIndex(index)
                  }
                }}
              >
                {renderOption ? renderOption(option, isActive) : option.label}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
})
