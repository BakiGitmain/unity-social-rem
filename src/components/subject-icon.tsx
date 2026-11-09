/** Simple flat SVG icons drawn for each subject. Colours come from the subject theme. */
export function SubjectIcon({ slug, className = "size-12" }: { slug: string; className?: string }) {
  const common = { className, viewBox: "0 0 48 48", "aria-hidden": true, fill: "none" } as const;

  switch (slug) {
    case "geography":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="17" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
          <path
            d="M14 18c3-1 5 1 7 0s3-4 6-3 2 4 5 4 3 3 1 5-5 1-6 3 1 5-2 6-4-2-5-4-4-2-5-5 1-5-1-6z"
            fill="var(--accent)"
            opacity=".85"
          />
          <path d="M7 24h34M24 7c-5 5-5 29 0 34M24 7c5 5 5 29 0 34" stroke="var(--accent)" strokeWidth="1.2" opacity=".35" />
        </svg>
      );
    case "mathematics":
      return (
        <svg {...common}>
          <rect x="7" y="7" width="34" height="34" rx="9" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
          <path d="M24 9v30M9 24h30" stroke="var(--accent)" strokeWidth="1.2" opacity=".3" />
          <path d="M12.5 16.5h7M16 13v7" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M28.5 16.5h7" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M13.5 29l5 5M18.5 29l-5 5" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M28.5 30h7M28.5 33.5h7" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "english":
      return (
        <svg {...common}>
          <path d="M8 12c6-2 11-1 16 2v25c-5-3-10-4-16-2z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M40 12c-6-2-11-1-16 2v25c5-3 10-4 16-2z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 28l3.5-9 3.5 9M13.2 25h4.6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M29 19h7M29 23h7M29 27h5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M9 17L24 8l15 9z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          <rect x="10" y="17" width="28" height="3" rx="1" fill="var(--accent)" opacity=".85" />
          <path d="M14 21v14M20 21v14M28 21v14M34 21v14" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="8" y="35" width="32" height="5" rx="1.5" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
        </svg>
      );
  }
}

/** The site logo mark: two overlapping speech/leaf shapes = learning together. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0f766e" />
      <path d="M9 10.5c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8V21l-3-2.4H10.8c-1 0-1.8-.8-1.8-1.8z" fill="#e3f3ef" />
      <path d="M13.5 14.5c0-1 .8-1.8 1.8-1.8h6c1 0 1.7.8 1.7 1.8v9.3l-2.8-2.3h-4.9c-1 0-1.8-.8-1.8-1.8z" fill="#f6c76b" opacity=".95" />
    </svg>
  );
}
