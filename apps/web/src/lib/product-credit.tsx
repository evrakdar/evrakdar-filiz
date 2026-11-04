/** The one line that names the product, shown at the bottom of every screen. */
export function ProductCredit({ className }: { className?: string }) {
  return (
    <p className={className}>
      Evrakdar ile çalışır ·{" "}
      <a href="https://evrakdar.com" target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
        evrakdar.com
      </a>{" "}
      ·{" "}
      <a href="mailto:bilgi@evrakdar.com" className="underline-offset-2 hover:underline">
        bilgi@evrakdar.com
      </a>
    </p>
  );
}
