import type { ReactNode } from "react";

export default function AppSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="landing-shell">
      <div className="landing-backdrop" aria-hidden="true" />
      <div className="landing-noise" aria-hidden="true" />
      <div className="landing-vignette" aria-hidden="true" />

      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
