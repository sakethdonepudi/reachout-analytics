export function SocialGlyphs({ size = 20, className }: { size?: number; className?: string }) {
  const style = { width: size, height: size };
  return (
    <span className={className} aria-hidden>
      <svg viewBox="0 0 24 24" style={style} fill="#1877F2"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V14h2.7v8h3.4Z" /></svg>
      <svg viewBox="0 0 24 24" style={style} fill="none" stroke="#C13584" strokeWidth="2"><circle cx="12" cy="12" r="4.1" /><circle cx="17.6" cy="6.4" r="1.2" fill="#C13584" stroke="none" /><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /></svg>
      <svg viewBox="0 0 24 24" style={style} fill="#FF0000"><rect x="2.5" y="5.2" width="19" height="13.6" rx="3.2" /><path d="M10 9.2v5.6l4.8-2.8L10 9.2Z" fill="#fff" /></svg>
      <svg viewBox="0 0 24 24" style={style} fill="none" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16.5 10 10l3.5 3.5L20 7" /><path d="M14.5 7H20v5.5" /></svg>
    </span>
  );
}

export function ReachSparkline({ className, points = "0,26 12,22 24,24 36,15 48,18 60,10 72,12 84,5 96,7 108,2" }: { className?: string; points?: string }) {
  return (
    <svg viewBox="0 0 108 30" className={className} fill="none" aria-hidden>
      <polyline points={points} stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="108" cy="2" r="2.6" fill="#15803D" />
    </svg>
  );
}
