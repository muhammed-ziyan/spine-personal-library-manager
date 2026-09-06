import type { SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'library'
  | 'plus'
  | 'stats'
  | 'scan'
  | 'pencil'
  | 'search'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'star'
  | 'star-filled'
  | 'grid'
  | 'list'
  | 'trash'
  | 'check'
  | 'book'
  | 'keyboard'
  | 'camera-off'
  | 'alert'
  | 'sort'
  | 'refresh'
  | 'user'

const paths: Record<IconName, string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
  library: 'M5 4h3v16H5zM10 4h3v16h-3zM15.2 5.1l2.9-.8 4 15.4-2.9.8z',
  plus: 'M12 5v14M5 12h14',
  stats: 'M5 20V12M12 20V5M19 20v-9',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M11 9v6M14 9v6M17 9v6',
  pencil: 'M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5',
  close: 'M6 6l12 12M18 6 6 18',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-down': 'M5 9l7 7 7-7',
  star: 'M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z',
  'star-filled': 'M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  trash: 'M5 7h14M9 7V4h6v3M8 7l1 13h6l1-13',
  check: 'M5 12.5l4.5 4.5L19 7',
  book: 'M5 5.5A1.5 1.5 0 0 1 6.5 4H19v15H6.5A1.5 1.5 0 0 0 5 20.5zM5 5.5v15M8 4v15',
  keyboard: 'M3 7h18v10H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  'camera-off': 'M3 3l18 18M7 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12M21 15V9a2 2 0 0 0-2-2h-3l-2-2h-4M12 12a3 3 0 0 0 3 3',
  alert: 'M12 8v5M12 16.5h.01M10.3 4.3 3.4 16.2A2 2 0 0 0 5.1 19h13.8a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0z',
  sort: 'M6 5v14M6 19l-3-3M6 19l3-3M18 19V5M18 5l-3 3M18 5l3 3',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 22, ...rest }: IconProps) {
  const filled = name === 'star-filled'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  )
}
