import { partyBrand } from "@/lib/tamil-nadu/party-brand";
import { cn } from "@/lib/utils";

const SIZES = [16, 20, 24, 28] as const;
export type PartyBadgeSize = (typeof SIZES)[number];

/**
 * A round white badge with a thin party-coloured ring. Line-art symbols are
 * tinted with a CSS mask so every party reads as one icon set.
 */
export function PartyBadge({
  party,
  size = 20,
  className,
  title,
}: {
  party: string;
  size?: PartyBadgeSize | number;
  className?: string;
  title?: string;
}) {
  const brand = partyBrand(party);
  const px = Math.max(12, size);
  const inner = Math.round(px * 0.64);
  const monogram = brand.monogram;
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full border align-middle",
        brand.plus ? "overflow-visible" : "overflow-hidden",
        monogram ? "text-white" : "bg-white",
        className,
      )}
      style={{
        width: px,
        height: px,
        borderColor: brand.color,
        background: monogram ? brand.color : undefined,
      }}
      data-party-badge="true"
      role="img"
      aria-label={`${party} symbol`}
      title={title ?? party}
    >
      {brand.logo && brand.mask ? (
        <span
          aria-hidden
          className="block"
          style={{
            width: inner,
            height: inner,
            backgroundColor: brand.color,
            maskImage: `url(${brand.logo})`,
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
            WebkitMaskImage: `url(${brand.logo})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            WebkitMaskSize: "contain",
          }}
        />
      ) : brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logo}
          alt=""
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="object-contain"
          style={{ width: inner, height: inner }}
        />
      ) : (
        <span aria-hidden className="grid h-full w-full place-items-center font-bold leading-none" style={{ fontSize: Math.max(6, Math.round(px * (monogram && monogram.length > 3 ? 0.24 : 0.32))) }}>
          {monogram ?? party.slice(0, 3).toUpperCase()}
        </span>
      )}
      {brand.plus ? (
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full border border-white bg-[color:var(--theme-text)] text-[8px] font-bold leading-none text-[color:var(--theme-surface)]">+{brand.plus}</span>
      ) : null}
    </span>
  );
}

export default PartyBadge;
