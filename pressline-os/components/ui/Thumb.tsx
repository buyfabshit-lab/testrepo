/**
 * Plain <img> for supplier CDN photos, Storage signed URLs and mockups — hosts are
 * dynamic, so next/image would need remotePatterns for every one of them.
 */
export function Thumb({ src, alt = "", className = "" }: { src: string | null | undefined; alt?: string; className?: string }) {
  if (!src) return <span className={`inline-block bg-mf-line ${className}`} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
