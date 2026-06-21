// Ink-on-parchment quill mark. Uses currentColor so it inherits the
// surrounding text color (cream in the header, accent on light surfaces).
export default function Logo({ className, size = 26 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 4C13 5 8 9 6 16l2 2c7-2 11-7 12-14z" />
      <path d="M17.5 6.5 9 15" />
      <path d="M6 16l-2 4 4-2" />
      <circle cx="4.1" cy="19.9" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}
