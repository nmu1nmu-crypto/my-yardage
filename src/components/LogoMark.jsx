// The chosen app logo mark (design handoff block 4a): a dark rounded-square
// badge with a white golf ball, a gold crossed-clubs icon enlarged behind
// the "MY" wordmark so the club heads peek out past the letters, and the
// wordmark itself set in Space Grotesk (the one font exception in the
// whole app — every other label uses the system font).
export default function LogoMark({ size = 36 }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="My Yardage"
      role="img"
    >
      <rect x="0.65" y="0.65" width="34.7" height="34.7" rx="9.35" fill="url(#logo-bg)" stroke="#c9a94e" strokeWidth="1.3" />
      <circle cx="18" cy="18" r="9" fill="url(#logo-ball)" />
      <g stroke="#c9a94e" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
        <line x1="8" y1="27" x2="24" y2="7" />
        <line x1="8" y1="7" x2="24" y2="27" />
      </g>
      <g stroke="#c9a94e" strokeWidth="2.6" strokeLinecap="round">
        <line x1="6.5" y1="28.5" x2="12.5" y2="20.5" />
        <line x1="29.5" y1="28.5" x2="23.5" y2="20.5" />
      </g>
      <text
        x="18"
        y="22.5"
        textAnchor="middle"
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight="700"
        fontSize="12.5"
        fill="#123822"
      >
        MY
      </text>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1b3b26" />
          <stop offset="1" stopColor="#0f2419" />
        </linearGradient>
        <radialGradient id="logo-ball" cx="0.35" cy="0.3" r="0.85">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9e9e4" />
        </radialGradient>
      </defs>
    </svg>
  );
}
