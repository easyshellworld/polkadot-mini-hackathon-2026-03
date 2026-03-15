import type { ReactNode } from "react";

export type Tone = "amber" | "rose" | "sage" | "sky";

export function TintMark({
  children,
  inverse = false,
  tone,
}: {
  children: ReactNode;
  inverse?: boolean;
  tone: Tone;
}) {
  const toneClassMap: Record<Tone, string> = inverse
    ? {
        amber:
          "bg-[rgba(252,211,77,0.18)] text-white shadow-[inset_0_-1px_0_rgba(252,211,77,0.22)]",
        rose: "bg-[rgba(251,113,133,0.18)] text-white shadow-[inset_0_-1px_0_rgba(251,113,133,0.22)]",
        sage: "bg-[rgba(110,231,183,0.16)] text-white shadow-[inset_0_-1px_0_rgba(110,231,183,0.2)]",
        sky: "bg-[rgba(125,211,252,0.18)] text-white shadow-[inset_0_-1px_0_rgba(125,211,252,0.22)]",
      }
    : {
        amber:
          "bg-[rgba(252,211,77,0.26)] text-neutral-950 shadow-[inset_0_-1px_0_rgba(252,211,77,0.3)]",
        rose: "bg-[rgba(251,113,133,0.18)] text-neutral-950 shadow-[inset_0_-1px_0_rgba(251,113,133,0.24)]",
        sage: "bg-[rgba(167,243,208,0.28)] text-neutral-950 shadow-[inset_0_-1px_0_rgba(110,231,183,0.26)]",
        sky: "bg-[rgba(191,219,254,0.34)] text-neutral-950 shadow-[inset_0_-1px_0_rgba(125,211,252,0.28)]",
      };

  return (
    <span
      className={`inline rounded-[0.72rem] box-decoration-clone px-2 py-0.5 ${toneClassMap[tone]}`}
    >
      {children}
    </span>
  );
}

export function UnderlineMark({
  children,
  inverse = false,
  tone,
}: {
  children: ReactNode;
  inverse?: boolean;
  tone: Tone;
}) {
  const toneClassMap: Record<Tone, string> = inverse
    ? {
        amber: "decoration-[rgba(252,211,77,0.78)] text-white/95",
        rose: "decoration-[rgba(251,113,133,0.8)] text-white/95",
        sage: "decoration-[rgba(110,231,183,0.8)] text-white/95",
        sky: "decoration-[rgba(125,211,252,0.8)] text-white/95",
      }
    : {
        amber: "decoration-[rgba(252,211,77,0.95)] text-neutral-950",
        rose: "decoration-[rgba(251,113,133,0.86)] text-neutral-950",
        sage: "decoration-[rgba(110,231,183,0.92)] text-neutral-950",
        sky: "decoration-[rgba(125,211,252,0.92)] text-neutral-950",
      };

  return (
    <span
      className={`inline underline decoration-wavy decoration-[0.14em] underline-offset-[0.22em] ${toneClassMap[tone]}`}
    >
      {children}
    </span>
  );
}
