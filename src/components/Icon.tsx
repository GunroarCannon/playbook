import { UI_ICONS, type UiIconName } from "./ui-icons";

/** A Font Awesome Free (CC BY 4.0) or hand-drawn icon from ui-icons.ts. Height = size (default 1em); colour = currentColor. */
export default function Icon({ name, size = "1em", className, title }: { name: UiIconName; size?: number | string; className?: string; title?: string }) {
  const [w, h, d] = UI_ICONS[name];
  const paths: readonly string[] = typeof d === "string" ? [d] : d;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      height={size}
      width={typeof size === "number" ? (size * w) / h : undefined}
      style={typeof size === "number" ? undefined : { width: `calc(${size} * ${(w / h).toFixed(3)})` }}
      fill="currentColor"
      className={`inline-block shrink-0 ${className ?? ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}
