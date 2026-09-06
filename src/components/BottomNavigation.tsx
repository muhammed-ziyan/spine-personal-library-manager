import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import styles from './BottomNavigation.module.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
  emphasized?: boolean
}

const items: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/library', label: 'Library', icon: 'library' },
  { to: '/add', label: 'Add', icon: 'plus', emphasized: true },
  { to: '/stats', label: 'Stats', icon: 'stats' },
]

export function BottomNavigation() {
  return (
    <nav className={styles.nav} aria-label="Primary">
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => [styles.link, item.emphasized && styles.emphasized, isActive && styles.active].filter(Boolean).join(' ')}
            >
              <span className={styles.iconWrap}>
                <Icon name={item.icon} size={item.emphasized ? 26 : 23} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
