import type { SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'library'
  | 'book-check'
  | 'plus'
  | 'minus'
  | 'stats'
  | 'user'
  | 'scan'
  | 'list'
  | 'grid'
  | 'search'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'more'
  | 'trash'
  | 'check'
  | 'torch'
  | 'upload'
  | 'download'
  | 'sort'
  | 'pencil'
  | 'keyboard'
  | 'camera-off'
  | 'alert'
  | 'refresh'
  | 'tag'
  | 'logout'
  | 'copy'

/** Lucide outlines, drawn at the mockup's 2.75 stroke. */
const paths: Record<IconName, string> = {
  home: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8 M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  library: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  'book-check': 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20 M9 10l2 2 4-4',
  plus: 'M5 12h14 M12 5v14',
  minus: 'M5 12h14',
  stats: 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
  user: 'M17 8a5 5 0 1 1-10 0a5 5 0 1 1 10 0 M20 21a8 8 0 0 0-16 0',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M8 8v8 M12 8v8 M16 8v8',
  list: 'M3 6h18 M3 12h18 M3 18h18',
  grid: 'M5 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M16 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M5 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z M16 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z',
  search: 'M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0 M21 21l-4.3-4.3',
  close: 'M18 6 6 18 M6 6l12 12',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  more: 'M13 12a1 1 0 1 1-2 0a1 1 0 1 1 2 0 M20 12a1 1 0 1 1-2 0a1 1 0 1 1 2 0 M6 12a1 1 0 1 1-2 0a1 1 0 1 1 2 0',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  check: 'M20 6 9 17l-5-5',
  torch: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
  upload: 'M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  download: 'M12 15V3 M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5',
  sort: 'M3 16l4 4 4-4 M7 20V4 M21 8l-4-4-4 4 M17 4v16',
  pencil: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z M15 5l4 4',
  keyboard: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 9h.01 M11 9h.01 M15 9h.01 M7 13h10',
  'camera-off': 'M2 2l20 20 M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h11 M20 16.5V9a2 2 0 0 0-2-2h-2l-2-2H9 M14.1 14.1a3 3 0 1 1-4.2-4.2',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  refresh: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16 M16 16h5v5',
  tag: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z M7 7h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  copy: 'M8 8h12v12H8z M16 8V4H4v12h4',
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 24, strokeWidth = 2.75, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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
