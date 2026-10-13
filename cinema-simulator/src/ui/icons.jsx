// Small inline SVG icons (no icon library needed).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const PlayIcon = () => (<svg {...base}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>)
export const PauseIcon = () => (<svg {...base}><path d="M8 5v14M16 5v14" strokeWidth="3" /></svg>)
export const VolumeIcon = () => (<svg {...base}><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>)
export const MuteIcon = () => (<svg {...base}><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M17 9l5 6M22 9l-5 6" /></svg>)
export const SeatIcon = () => (<svg {...base}><path d="M6 4h12v9H6zM4 13h16v4H4zM7 17v3M17 17v3" /></svg>)
export const GearIcon = () => (<svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>)
export const CloseIcon = () => (<svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>)
