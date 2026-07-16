import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

/**
 * Accessible Tabs component built on the WAI-ARIA Authoring Practices
 * "Tabs" pattern. Supports keyboard navigation with ArrowLeft/ArrowRight,
 * Home, and End, and announces the active panel through `aria-labelledby`.
 */

type TabsContextValue = {
  value: string
  setValue: (next: string) => void
  baseId: string
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void
  getTriggerElement: (value: string) => HTMLButtonElement | null
  values: string[]
  /** Latest value that requested focus. Read once by the matching trigger. */
  focusRequestRef: React.MutableRefObject<string | null>
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error(`<${component}> must be used inside <Tabs>.`)
  }
  return context
}

export type TabsProps = {
  /** Currently active tab value (controlled). */
  value?: string
  /** Initial active tab value when uncontrolled. */
  defaultValue?: string
  /** Called when the active tab changes. */
  onValueChange?: (value: string) => void
  /** Accessible label for the tab list. */
  ariaLabel: string
  /** Optional className applied to the outer wrapper. */
  className?: string
  /** Tabs content: <TabsList> followed by <TabsPanel> children. */
  children: ReactNode
  /** id used as a base for the underlying tab/panel ids. */
  id?: string
}

export function Tabs(props: TabsProps) {
  const { value, defaultValue, onValueChange, ariaLabel, className, children, id } = props

  const reactId = useId()
  const baseId = id ?? `tabs-${reactId.replace(/:/g, '')}`

  const triggerRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  const orderedValues = useMemo(() => {
    const list: string[] = []
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
        return
      }
      if ((child.type as { displayName?: string }).displayName === 'TabsList') {
        const listChildren = (child.props as { children?: ReactNode }).children
        Children.forEach(listChildren, (trigger) => {
          if (!isValidElement(trigger)) {
            return
          }
          if ((trigger.type as { displayName?: string }).displayName === 'TabsTrigger') {
            const triggerValue = (trigger.props as { value?: unknown }).value
            if (typeof triggerValue === 'string' && !list.includes(triggerValue)) {
              list.push(triggerValue)
            }
          }
        })
      }
    })
    return list
  }, [children])

  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<string | null>(
    () => defaultValue ?? null,
  )

  // Derive the active tab from props + internal selection. We avoid
  // syncing `internalValue` inside an effect because that triggers a
  // cascading render and trips react-hooks/set-state-in-effect.
  const resolvedValue = isControlled
    ? (value as string)
    : (internalValue ?? defaultValue ?? '')
  const safeValue = orderedValues.includes(resolvedValue)
    ? resolvedValue
    : (orderedValues[0] ?? '')

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) {
        setInternalValue(next)
      }
      onValueChange?.(next)
    },
    [isControlled, onValueChange],
  )

  const registerTrigger = useCallback((triggerValue: string, element: HTMLButtonElement | null) => {
    if (element) {
      triggerRefs.current.set(triggerValue, element)
    } else {
      triggerRefs.current.delete(triggerValue)
    }
  }, [])

  const getTriggerElement = useCallback(
    (triggerValue: string) => triggerRefs.current.get(triggerValue) ?? null,
    [],
  )

  // Latest value that asked for focus via keyboard nav. The matching
  // TabsTrigger consumes it during its render and clears it. Using a
  // ref (instead of state) avoids the cascading-render warning and
  // keeps focus decisions synchronous with the tab activation.
  const focusRequestRef = useRef<string | null>(null)

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      value: safeValue,
      setValue,
      baseId,
      registerTrigger,
      getTriggerElement,
      values: orderedValues,
      focusRequestRef,
    }),
    [safeValue, setValue, baseId, registerTrigger, getTriggerElement, orderedValues],
  )

  const wrapperClassName = ['tabs', className].filter(Boolean).join(' ')

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={wrapperClassName}>
        {/*
         * The TabsList + TabsPanel children render themselves by reaching
         * into context, so we forward props (e.g. ariaLabel) through the
         * clone of the TabsList element below.
         */}
        {Children.map(children, (child) => {
          if (!isValidElement(child)) {
            return child
          }
          if ((child.type as { displayName?: string }).displayName === 'TabsList') {
            return cloneElement(
              child as ReactElement<Record<string, unknown>>,
              { 'aria-label': ariaLabel },
            )
          }
          return child
        })}
      </div>
    </TabsContext.Provider>
  )
}

Tabs.displayName = 'Tabs'

export type TabsListProps = {
  children: ReactNode
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

export function TabsList(props: TabsListProps) {
  const { children, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy } = props
  const { values, value, setValue, focusRequestRef } = useTabsContext('TabsList')
  const listRef = useRef<HTMLDivElement>(null)

  const requestFocus = useCallback(
    (triggerValue: string) => {
      focusRequestRef.current = triggerValue
    },
    [focusRequestRef],
  )

  const focusAt = useCallback(
    (index: number) => {
      const target = values[(index + values.length) % values.length]
      if (!target) {
        return
      }
      requestFocus(target)
      setValue(target)
    },
    [values, setValue, requestFocus],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (values.length === 0) {
      return
    }
    const currentIndex = values.indexOf(value)

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(currentIndex < 0 ? 0 : currentIndex + 1)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(currentIndex < 0 ? values.length - 1 : currentIndex - 1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusAt(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusAt(values.length - 1)
      return
    }
  }

  const listClassName = ['tabs-list', className].filter(Boolean).join(' ')

  return (
    <div
      ref={listRef}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={listClassName}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}

TabsList.displayName = 'TabsList'

export type TabsTriggerProps = {
  value: string
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function TabsTrigger(props: TabsTriggerProps) {
  const { value, disabled = false, className, children } = props
  const { value: activeValue, setValue, registerTrigger, baseId, focusRequestRef } =
    useTabsContext('TabsTrigger')
  const isActive = activeValue === value
  const triggerId = `${baseId}-trigger-${value}`
  const panelId = `${baseId}-panel-${value}`
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const handleClick = () => {
    if (disabled) {
      return
    }
    setValue(value)
  }

  // Consume a pending focus request for this value: when keyboard nav
  // (Arrow / Home / End) flips the active value, the matching trigger
  // takes focus here. We schedule the focus in a microtask so it runs
  // after React commits the new active state but before the next paint,
  // and after the browser has applied the keydown default behavior.
  useEffect(() => {
    if (focusRequestRef.current !== value) {
      return
    }
    focusRequestRef.current = null
    const target = buttonRef.current
    if (!target) {
      return
    }
    // Defer to a microtask so React finishes its commit and the
    // browser settles the focus state before we move it. This keeps
    // jsdom (which runs React 19 effects in a separate microtask
    // queue) and real browsers in sync.
    Promise.resolve().then(() => {
      target.focus()
    })
  })

  const buttonClassName = [
    'tabs-trigger',
    isActive ? 'active' : '',
    disabled ? 'disabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={(element) => {
        buttonRef.current = element
        registerTrigger(value, element)
      }}
      aria-controls={panelId}
      aria-selected={isActive}
      className={buttonClassName}
      disabled={disabled}
      id={triggerId}
      role="tab"
      tabIndex={isActive ? 0 : -1}
      type="button"
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

TabsTrigger.displayName = 'TabsTrigger'

export type TabsPanelProps = {
  value: string
  className?: string
  children: ReactNode
  /** When true, the panel stays mounted but is hidden via [hidden]. */
  forceMount?: boolean
}

export function TabsPanel(props: TabsPanelProps) {
  const { value, className, children, forceMount = false } = props
  const { value: activeValue, baseId } = useTabsContext('TabsPanel')
  const isActive = activeValue === value
  const panelId = `${baseId}-panel-${value}`
  const triggerId = `${baseId}-trigger-${value}`

  if (!isActive && !forceMount) {
    return null
  }

  const panelClassName = ['tabs-panel', className].filter(Boolean).join(' ')

  return (
    <div
      aria-labelledby={triggerId}
      className={panelClassName}
      hidden={!isActive}
      id={panelId}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  )
}

TabsPanel.displayName = 'TabsPanel'
