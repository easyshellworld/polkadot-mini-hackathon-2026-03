"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type FloatingReturnHandleProps = {
  href: string;
  label: string;
};

type DockSide = "left" | "right" | "top";

type DockPlacement =
  | {
      offset: number;
      side: "left" | "right";
    }
  | {
      offset: number;
      side: "top";
    };

type DragState = {
  moved: boolean;
  offsetX: number;
  offsetY: number;
  pointerId: number;
};

const iconSize = 48;
const dockedInset = 16;
const edgeInset = 14;
const topDockLabelInset = 88;

export function FloatingReturnHandle({
  href,
  label,
}: FloatingReturnHandleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dragStateRef = useRef<DragState | null>(null);
  const hasInitializedPlacementRef = useRef(false);
  const [viewport, setViewport] = useState({
    height: 0,
    width: 0,
  });
  const [placement, setPlacement] = useState<DockPlacement>({
    offset: edgeInset,
    side: "left",
  });
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const syncViewport = () => {
      setViewport({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!viewport.width || !viewport.height) {
      return;
    }

    if (!hasInitializedPlacementRef.current) {
      hasInitializedPlacementRef.current = true;
      setPlacement({
        offset: edgeInset,
        side: "left",
      });
      return;
    }

    setPlacement((currentPlacement) => {
      if (currentPlacement.side === "top") {
        return {
          offset: clamp(
            currentPlacement.offset,
            topDockLabelInset,
            viewport.width - topDockLabelInset - iconSize,
          ),
          side: "top",
        };
      }

      return {
        offset: clamp(
          currentPlacement.offset,
          edgeInset,
          viewport.height - iconSize - edgeInset,
        ),
        side: currentPlacement.side,
      };
    });
  }, [viewport.height, viewport.width]);

  const currentPosition = useMemo(() => {
    if (dragPosition) {
      return dragPosition;
    }

    if (placement.side === "left") {
      return {
        x: -dockedInset,
        y: placement.offset,
      };
    }

    if (placement.side === "right") {
      return {
        x: viewport.width - iconSize + dockedInset,
        y: placement.offset,
      };
    }

    return {
      x: placement.offset,
      y: -dockedInset,
    };
  }, [dragPosition, placement, viewport.width]);

  const targetHref = useMemo(() => {
    const nav = searchParams.get("nav");

    if (nav !== "compact") {
      return href;
    }

    const nextSearchParams = new URLSearchParams(href.split("?")[1] ?? "");
    nextSearchParams.set("nav", nav);

    const baseHref = href.split("?")[0] ?? href;
    const query = nextSearchParams.toString();

    return query ? `${baseHref}?${query}` : baseHref;
  }, [href, searchParams]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    dragStateRef.current = {
      moved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      pointerId: event.pointerId,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextX = clamp(
      event.clientX - dragState.offsetX,
      -dockedInset,
      viewport.width - iconSize + dockedInset,
    );
    const nextY = clamp(
      event.clientY - dragState.offsetY,
      -dockedInset,
      viewport.height - iconSize,
    );

    dragStateRef.current = {
      ...dragState,
      moved:
        dragState.moved ||
        Math.abs(nextX - currentPosition.x) > 3 ||
        Math.abs(nextY - currentPosition.y) > 3,
    };

    setDragPosition({
      x: nextX,
      y: nextY,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || !viewport.width) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!dragState.moved) {
      dragStateRef.current = null;
      setDragPosition(null);
      router.push(targetHref);
      return;
    }

    const position = dragPosition ?? currentPosition;
    const centerX = position.x + iconSize / 2;
    const centerY = position.y + iconSize / 2;
    const distanceToLeft = centerX;
    const distanceToRight = viewport.width - centerX;
    const distanceToTop = centerY;
    const closestSide = (
      [
        { distance: distanceToLeft, side: "left" as const },
        { distance: distanceToRight, side: "right" as const },
        { distance: distanceToTop, side: "top" as const },
      ] as const
    ).reduce((closest, candidate) => {
      return candidate.distance < closest.distance ? candidate : closest;
    });

    if (closestSide.side === "top") {
      setPlacement({
        offset: clamp(
          centerX - iconSize / 2,
          topDockLabelInset,
          viewport.width - topDockLabelInset - iconSize,
        ),
        side: "top",
      });
    } else {
      setPlacement({
        offset: clamp(
          centerY - iconSize / 2,
          edgeInset,
          viewport.height - iconSize - edgeInset,
        ),
        side: closestSide.side,
      });
    }

    dragStateRef.current = null;
    setDragPosition(null);
  };

  const labelClassName =
    placement.side === "left"
      ? "left-full top-1/2 ml-3 -translate-y-1/2 -translate-x-2 group-hover:translate-x-0 group-focus-visible:translate-x-0"
      : placement.side === "right"
        ? "right-full top-1/2 mr-3 -translate-y-1/2 translate-x-2 group-hover:translate-x-0 group-focus-visible:translate-x-0"
        : "left-1/2 top-full mt-3 -translate-x-1/2 -translate-y-2 group-hover:translate-y-0 group-focus-visible:translate-y-0";

  return (
    <div
      className="pointer-events-none fixed z-30"
      style={{
        left: `${currentPosition.x}px`,
        top: `${currentPosition.y}px`,
      }}
    >
      <button
        type="button"
        aria-label={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="group pointer-events-auto relative flex size-12 cursor-grab items-center justify-center rounded-full bg-[rgba(255,255,255,0.9)] text-neutral-950 shadow-[0_16px_40px_rgba(15,17,17,0.15),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-md transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_22px_48px_rgba(15,17,17,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)]"
        style={{ touchAction: "none" }}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white shadow-[0_10px_24px_rgba(15,17,17,0.22)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] group-focus-visible:scale-[1.03]">
          <BackChevronIcon />
        </span>

        <span
          className={`pointer-events-none absolute whitespace-nowrap rounded-full border border-black/8 bg-[rgba(255,255,255,0.88)] px-4 py-2 text-[0.9rem] font-semibold tracking-[-0.03em] text-neutral-950 opacity-0 shadow-[0_18px_40px_rgba(15,17,17,0.12),inset_0_1px_0_rgba(255,255,255,0.88)] backdrop-blur-md transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-focus-visible:opacity-100 ${labelClassName}`}
        >
          {label}
        </span>
      </button>
    </div>
  );
}

function BackChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.75 2.25L4 7L8.75 11.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
