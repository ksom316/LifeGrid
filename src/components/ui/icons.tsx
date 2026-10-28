import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconHome = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
)

export const IconFolder = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
  </svg>
)

export const IconBook = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
    <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" />
  </svg>
)

export const IconTimer = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2" />
    <path d="M9 2h6" />
  </svg>
)

export const IconPlus = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconCheck = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 13l4 4L19 7" />
  </svg>
)

export const IconMenu = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export const IconX = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const IconNote = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 3h9l5 5v13H6z" />
    <path d="M15 3v5h5" />
  </svg>
)

export const IconFlag = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 21V4" />
    <path d="M5 5h13l-3 4 3 4H5" />
  </svg>
)

export const IconSearch = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IconTrash = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

export const IconPencil = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14.5 4.5l5 5L8 21H3v-5Z" />
  </svg>
)

export const IconArrowLeft = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </svg>
)

export const IconAlertTriangle = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9v5" />
    <path d="M12 17h.01" />
  </svg>
)

export const IconPlay = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M7 4v16l13-8Z" strokeLinejoin="round" fill="currentColor" stroke="none" />
  </svg>
)

export const IconPause = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8 5v14M16 5v14" />
  </svg>
)

export const IconStop = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
)

export const IconChevronLeft = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14 6l-6 6 6 6" />
  </svg>
)

export const IconChevronRight = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M10 6l6 6-6 6" />
  </svg>
)

export const IconClipboard = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 11h6M9 15h6" />
  </svg>
)

export const IconPin = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
    <path d="M12 15v5" />
  </svg>
)

export const IconTag = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-.3.7l-9 9a1 1 0 0 1-1.4 0l-7-7a1 1 0 0 1 0-1.4l9-9A1 1 0 0 1 12 2Z" />
    <circle cx="16.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSettings = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)

export const IconDownload = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M4 19h16" />
  </svg>
)

export const IconUpload = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 21V9" />
    <path d="M7 14l5-5 5 5" />
    <path d="M4 19h16" />
  </svg>
)

export const IconRepeat = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

export const IconBell = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
)

export const IconCalendar = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)

export const IconSparkles = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
  </svg>
)

export const IconSun = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
  </svg>
)

export const IconMoon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
  </svg>
)

export const IconMonitor = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
)

export const IconListBullet = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <path d="M9 6h11M9 12h11M9 18h11" />
  </svg>
)

export const IconListDash = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3.5 6h3M3.5 12h3M3.5 18h3" />
    <path d="M9 6h11M9 12h11M9 18h11" />
  </svg>
)

export const IconListNumbered = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 4.5v3M3.3 4.5h1.4M3.3 10.5h1.6a.9.9 0 0 0 .1-1.8H3.4a.9.9 0 0 1 .1-1.7h1.5M3.3 15.5h1.7a1 1 0 0 1 0 2H4.4l1 .1a1 1 0 0 1 0 2H3.3" />
  </svg>
)

export const IconListCheck = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="4.5" height="4.5" rx="1" />
    <path d="M4 6.2l.9.9L6.5 5.5" />
    <rect x="3" y="15.5" width="4.5" height="4.5" rx="1" />
    <path d="M10.5 6h10M10.5 17.75h10" />
  </svg>
)

export const IconCode = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5" />
  </svg>
)

export const IconIndentIncrease = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3.5 5h17M3.5 19h17M11.5 10h9M11.5 14h9" />
    <path d="M3.5 9.5 7 12l-3.5 2.5z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconIndentDecrease = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3.5 5h17M3.5 19h17M11.5 10h9M11.5 14h9" />
    <path d="M7 9.5 3.5 12 7 14.5z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconChevronDown = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
