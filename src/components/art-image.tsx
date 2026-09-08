import type { CSSProperties } from "react";
export function ArtImage({
  name,
  alt,
  className = "",
  eager = false,
  sizes = "(max-width: 700px) 100vw, 50vw",
  style,
}: {
  name: string;
  alt: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      className={`art-image ${className}`}
      src={`/images/${name}-800.webp`}
      srcSet={[480, 800, 1440]
        .map((w) => `/images/${name}-${w}.webp ${w}w`)
        .join(", ")}
      sizes={sizes}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      width="1086"
      height="1448"
      style={style}
    />
  );
}
