export function ArrowIcon({ direction = "right" }: { direction?: "right" | "left" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 16" className={direction === "left" ? "rotate-180" : ""}>
      <path d="M1 8h28M23 1l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
