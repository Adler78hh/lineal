// Simple line icons (24×24), so children who cannot read yet still find the buttons.
const icon = (body: string) =>
  `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  grid: icon('<circle cx="5" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="19" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/><circle cx="19" cy="19" r="1.6" fill="currentColor"/>'),
  ruler: icon('<rect x="2" y="8" width="20" height="8" rx="1.5" transform="rotate(-30 12 12)"/><path d="M7.5 12.8l-1-1.7M10.5 11l-1.5-2.6M13.5 9.3l-1-1.7M16.5 7.5l-1.5-2.6" transform="translate(0.6 2.2)"/>'),
  eraser: icon('<path d="M4 15.5l9-9a2 2 0 0 1 2.8 0l3.7 3.7a2 2 0 0 1 0 2.8L13 19.5H8z"/><path d="M8.5 11l5.5 5.5M13 19.5h7"/>'),
  undo: icon('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  check: icon('<path d="M4 12.5l5 5L20 6.5"/>'),
  prev: icon('<path d="M15 5l-7 7 7 7"/>'),
  next: icon('<path d="M9 5l7 7-7 7"/>'),
};
