import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
/** sm 44px · md 52px · lg 58px · xl 60px, as on the mockup screens. */
type Size = 'sm' | 'md' | 'lg' | 'xl'

interface BaseProps {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  block?: boolean
  loading?: boolean
  children?: ReactNode
  className?: string
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined }
type LinkProps = BaseProps & { to: string; replace?: boolean; state?: unknown; onClick?: () => void }

function classes({ variant = 'primary', size = 'md', block, loading, className }: BaseProps) {
  return [styles.button, styles[variant], styles[size], block && styles.block, loading && styles.loading, className]
    .filter(Boolean)
    .join(' ')
}

const iconSize: Record<Size, number> = { sm: 18, md: 20, lg: 22, xl: 22 }

export const Button = forwardRef<HTMLButtonElement, ButtonProps | LinkProps>(function Button(props, ref) {
  const { icon, iconRight, children, loading, size = 'md' } = props
  const content = (
    <>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {icon && !loading && <Icon name={icon} size={iconSize[size]} />}
      {children && <span className={styles.label}>{children}</span>}
      {iconRight && <Icon name={iconRight} size={18} />}
    </>
  )

  if ('to' in props && props.to !== undefined) {
    const { to, replace, state, onClick } = props
    return (
      <Link to={to} replace={replace} state={state} onClick={onClick} className={classes(props)}>
        {content}
      </Link>
    )
  }

  const { variant: _v, size: _s, icon: _i, iconRight: _ir, block: _b, loading: _l, className: _c, disabled, ...rest } = props as ButtonProps
  return (
    <button ref={ref} type="button" {...rest} className={classes(props)} disabled={disabled || loading} aria-busy={loading || undefined}>
      {content}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  size?: number
  /** surface: 40px cream circle · dim: translucent circle for dark screens · plain: no fill · large: 52px surface circle */
  tone?: 'surface' | 'dim' | 'plain' | 'large'
}

/** Round icon-only control (back, close, more, torch…). */
export function IconButton({ icon, label, size = 20, tone = 'surface', className, ...rest }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} className={[styles.iconButton, styles[`tone-${tone}`], className].filter(Boolean).join(' ')} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  )
}

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'accent' | 'muted' | 'danger'
}

/** Bare text action ("Cancel", "See all", "Reset", "Delete this book"). */
export function TextButton({ tone = 'accent', className, children, ...rest }: TextButtonProps) {
  return (
    <button type="button" className={[styles.textButton, styles[`text-${tone}`], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  )
}
