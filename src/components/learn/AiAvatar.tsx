// The Etivio AI character (the "spark", from the Zaane Figma file) in Etivio blue. It floats and blinks, and spins
// while an answer is on its way. Motion is off for people who ask for reduced motion.
export function AiAvatar({ size = 32, busy = false, className = "" }: { size?: number; busy?: boolean; className?: string }) {
  return (
    <svg className={`et-aia${busy ? " is-busy" : ""}${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 320 320" aria-hidden>
      <circle cx="160" cy="160" r="160" fill="#dbe7fd" />
      <g className="et-aia-body">
        <path d="M160 48C180 48 179 100 203 117C224 132 270 136 270 158C270 179 222 182 204 201C184 220 180 271 160 271C139 271 136 220 116 201C97 182 49 181 49 160C49 138 96 134 116 115C136 96 138 48 160 48Z" fill="#2563eb" />
        <g className="et-aia-eyes">
          <ellipse cx="132" cy="151" rx="12" ry="21" fill="#fffaf0" />
          <ellipse cx="187" cy="151" rx="12" ry="21" fill="#fffaf0" />
        </g>
        <path d="M147 188C155.667 196.667 164.333 196.667 173 188" stroke="#fffaf0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx="110.5" cy="182" rx="7.5" ry="4" fill="#93b4f6" />
        <ellipse cx="210.5" cy="182" rx="7.5" ry="4" fill="#93b4f6" />
      </g>
    </svg>
  );
}
