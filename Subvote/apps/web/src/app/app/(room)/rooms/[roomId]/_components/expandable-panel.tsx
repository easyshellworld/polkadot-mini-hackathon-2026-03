"use client";

import { useState, type ReactNode } from "react";

type ExpandablePanelProps = {
  children: ReactNode;
  collapseLabel: string;
  contentAreaClassName?: string;
  contentClassName?: string;
  expandLabel: string;
  fadeClassName?: string;
  header: ReactNode;
  panelClassName?: string;
  viewportClassName?: string;
};

const collapsedPanelHeightClass = "h-[21rem]";
const expandedPanelHeightClass = "h-[29rem]";

export function ExpandablePanel({
  children,
  collapseLabel,
  contentAreaClassName,
  contentClassName,
  expandLabel,
  fadeClassName,
  header,
  panelClassName,
  viewportClassName,
}: ExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        className={`flex flex-col transition-[height] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isExpanded ? expandedPanelHeightClass : collapsedPanelHeightClass
        } ${panelClassName ?? ""}`}
      >
        {header}

        <div className={`relative mt-3 min-h-0 flex-1 ${contentAreaClassName ?? ""}`}>
          <div
            className={`h-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isExpanded ? "overflow-y-auto" : "overflow-hidden"
            } ${viewportClassName ?? "pr-2"}`}
          >
            <div className={contentClassName}>{children}</div>
          </div>

          {!isExpanded ? (
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 ${
                fadeClassName ??
                "bg-[linear-gradient(180deg,rgba(245,241,232,0)_0%,rgba(245,241,232,0.7)_54%,rgba(245,241,232,0.96)_100%)]"
              }`}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? collapseLabel : expandLabel}
          onClick={() => {
            setIsExpanded((current) => !current);
          }}
          className="inline-flex size-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.54)] text-neutral-700 shadow-[0_12px_28px_rgba(15,17,17,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] transition-[background-color,transform,color] duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.78)] hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)]"
        >
          <ChevronIcon expanded={isExpanded} />
        </button>
      </div>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
    >
      <path
        d="M2.75 5L7 9.25L11.25 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
