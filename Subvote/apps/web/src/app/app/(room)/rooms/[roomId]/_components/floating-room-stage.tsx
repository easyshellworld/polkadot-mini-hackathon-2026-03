"use client";

import { User } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { FloatingCommentComposer } from "./floating-comment-composer";
import { RoomHostBoard } from "./room-host-board";
import { RoomProjectIntro } from "./room-project-intro";

import type { SquareRoom } from "@/app/app/_lib/mock-rooms";

export type FloatingRoomMessage = {
  author: string;
  copy: string;
  id: string;
  label: string;
  time: string;
  tone: "host" | "peer" | "self" | "system";
};

type FloatingRoomStageProps = {
  messages: readonly FloatingRoomMessage[];
  room: Pick<
    SquareRoom,
    | "category"
    | "closesAtLabel"
    | "creatorName"
    | "creatorRole"
    | "hostBoard"
    | "id"
    | "members"
    | "messages"
    | "openedAtLabel"
    | "projectOverview"
    | "status"
    | "title"
    | "topicHash"
  >;
};

type BubbleBody = {
  anchorX: number;
  anchorY: number;
  driftX: number;
  driftY: number;
  height: number;
  phaseX: number;
  phaseY: number;
  velocityX: number;
  velocityY: number;
  width: number;
  x: number;
  y: number;
};

type DragState = {
  index: number;
  lastClientX: number;
  lastClientY: number;
  lastMoveAt: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  velocityX: number;
  velocityY: number;
};

type VpSortMode = "low" | "high";

const stagePadding = 10;
const initialVisibleMessageCount = 18;
const messageLoadBatch = 12;

export function FloatingRoomStage({
  messages,
  room,
}: FloatingRoomStageProps) {
  const composerSentinelRef = useRef<HTMLDivElement | null>(null);
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const loadTriggerRef = useRef<HTMLDivElement | null>(null);
  const bubbleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const bodiesRef = useRef<BubbleBody[]>([]);
  const stageSizeRef = useRef({ height: 0, width: 0 });
  const dragStateRef = useRef<DragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const [isComposerPinned, setIsComposerPinned] = useState(false);
  const [isOwnMessagesFilterActive, setIsOwnMessagesFilterActive] = useState(false);
  const [vpSortMode, setVpSortMode] = useState<VpSortMode>("low");
  const [visibleCount, setVisibleCount] = useState(() => {
    return Math.min(initialVisibleMessageCount, messages.length);
  });
  const [stageHeight, setStageHeight] = useState(720);

  const orderedMessages = useMemo(() => {
    const baseOrder = messages
      .map((message, index) => {
        return {
          estimatedVpCost: getEstimatedMessageVpCost(room.category, message.copy),
          index,
          message,
        };
      })
      .filter((entry) => {
        return isOwnMessagesFilterActive ? entry.message.tone === "self" : true;
      });

    baseOrder.sort((left, right) => {
      const costDelta = left.estimatedVpCost - right.estimatedVpCost;

      if (costDelta !== 0) {
        return vpSortMode === "low" ? costDelta : -costDelta;
      }

      return left.index - right.index;
    });

    return baseOrder;
  }, [isOwnMessagesFilterActive, messages, room.category, vpSortMode]);

  const visibleMessages = useMemo(() => {
    return orderedMessages.slice(0, visibleCount);
  }, [orderedMessages, visibleCount]);
  const hasMoreMessages = visibleCount < orderedMessages.length;

  useEffect(() => {
    setVisibleCount(Math.min(initialVisibleMessageCount, orderedMessages.length));
    setStageHeight(720);
  }, [orderedMessages]);

  useEffect(() => {
    const composer = composerShellRef.current;

    if (!composer) {
      return;
    }

    const updateComposerHeight = () => {
      setComposerHeight(composer.getBoundingClientRect().height);
    };

    updateComposerHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateComposerHeight();
    });

    resizeObserver.observe(composer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const updatePinnedState = () => {
      const sentinel = composerSentinelRef.current;
      const stage = stageRef.current;

      if (!sentinel || !stage) {
        return;
      }

      const topOffset = window.innerWidth < 640 ? 12 : 20;
      const sentinelTop = sentinel.getBoundingClientRect().top;
      const stageBottom = stage.getBoundingClientRect().bottom;
      const shouldPin =
        sentinelTop <= topOffset &&
        stageBottom > topOffset + Math.max(composerHeight, 88) + 24;

      setIsComposerPinned((current) => {
        return current !== shouldPin ? shouldPin : current;
      });
    };

    updatePinnedState();
    window.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", updatePinnedState);

    return () => {
      window.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", updatePinnedState);
    };
  }, [composerHeight]);

  useEffect(() => {
    const trigger = loadTriggerRef.current;

    if (!trigger || !hasMoreMessages) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => {
          if (current >= orderedMessages.length) {
            return current;
          }

          return Math.min(current + messageLoadBatch, orderedMessages.length);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px 160px 0px",
        threshold: 0,
      },
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreMessages, orderedMessages.length]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const applyTransforms = () => {
      bodiesRef.current.forEach((body, index) => {
        const node = bubbleRefs.current[index];

        if (!node) {
          return;
        }

        node.style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
      });
    };

    const syncBodies = (preservePosition: boolean) => {
      const nextWidth = stage.clientWidth;
      const nextHeight = stage.clientHeight;

      if (!nextWidth || !nextHeight) {
        return;
      }
      const previousBodies = bodiesRef.current;

      const columns = nextWidth < 720 ? 1 : nextWidth < 1180 ? 2 : 3;
      const columnGap = nextWidth < 720 ? 0 : 18;
      const stackGap = 14;
      const laneWidth =
        (nextWidth - stagePadding * 2 - columnGap * (columns - 1)) / columns;
      const laneStarts = Array.from({ length: columns }, (_, column) => {
        return stagePadding + column * (laneWidth + columnGap);
      });
      const columnHeights = Array.from({ length: columns }, (_, column) => {
        return stagePadding + seededUnit(column, 0.41) * 28;
      });

      const nextBodies = visibleMessages.map((message, index) => {
        const node = bubbleRefs.current[index];
        const previousBody = previousBodies[index];
        const width = node?.offsetWidth ?? 300;
        const height = node?.offsetHeight ?? 168;
        const column = getShortestColumnIndex(columnHeights);
        const laneXStart = laneStarts[column] ?? stagePadding;
        const availableX = Math.max(0, laneWidth - width);
        const scatterX =
          (seededUnit(index, 0.71) - 0.5) * Math.min(availableX * 0.9, 56);
        const centeredX = laneXStart + availableX / 2;
        const laneDrift =
          (seededUnit(index, 2.11) - 0.5) * 2 * Math.min(12, laneWidth * 0.04);
        const anchorX = clamp(
          centeredX + laneDrift + scatterX,
          stagePadding,
          nextWidth - width - stagePadding,
        );
        const anchorY = Math.max(
          stagePadding,
          (columnHeights[column] ?? stagePadding) + (seededUnit(index, 1.37) - 0.5) * 18,
        );
        columnHeights[column] =
          anchorY + height + stackGap + seededUnit(index, 2.89) * 18;

        return {
          anchorX,
          anchorY,
          driftX: 7 + (index % 3) * 3,
          driftY: 6 + (index % 2) * 4,
          height,
          phaseX: (index + 1) * 1.17,
          phaseY: (index + 1) * 0.93,
          velocityX: preservePosition ? (previousBody?.velocityX ?? 0) : 0,
          velocityY: preservePosition ? (previousBody?.velocityY ?? 0) : 0,
          width,
          x: previousBody?.x ?? anchorX,
          y: previousBody?.y ?? anchorY,
        };
      });

      const requiredHeight = Math.max(
        640,
        Math.ceil(Math.max(...columnHeights, stagePadding) + stagePadding),
      );
      const layoutHeight = Math.max(nextHeight, requiredHeight);

      stageSizeRef.current = {
        height: layoutHeight,
        width: nextWidth,
      };

      bodiesRef.current = nextBodies.map((body) => {
        const maxX = nextWidth - body.width - stagePadding;
        const maxY = layoutHeight - body.height - stagePadding;

        return {
          ...body,
          anchorY: clamp(body.anchorY, stagePadding, maxY),
          x: preservePosition
            ? clamp(body.x, stagePadding, maxX)
            : clamp(body.anchorX, stagePadding, maxX),
          y: preservePosition
            ? clamp(body.y, stagePadding, maxY)
            : clamp(body.anchorY, stagePadding, maxY),
        };
      });

      setStageHeight((current) => {
        return Math.abs(current - requiredHeight) > 1 ? requiredHeight : current;
      });

      applyTransforms();
    };

    bubbleRefs.current = bubbleRefs.current.slice(0, visibleMessages.length);
    syncBodies(false);

    const resizeObserver = new ResizeObserver(() => {
      syncBodies(true);
    });

    resizeObserver.observe(stage);
    bubbleRefs.current.forEach((bubble) => {
      if (bubble) {
        resizeObserver.observe(bubble);
      }
    });

    let previousTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const frame = Math.min((timestamp - previousTimestamp) / 16.667, 2);
      previousTimestamp = timestamp;
      const dragState = dragStateRef.current;
      const { height, width } = stageSizeRef.current;

      bodiesRef.current.forEach((body, index) => {
        if (dragState?.index === index) {
          return;
        }

        const waveX =
          body.anchorX + Math.sin(timestamp * 0.00055 + body.phaseX) * body.driftX;
        const waveY =
          body.anchorY + Math.cos(timestamp * 0.00045 + body.phaseY) * body.driftY;

        body.velocityX += (waveX - body.x) * 0.02 * frame;
        body.velocityY += (waveY - body.y) * 0.022 * frame;
        body.velocityX *= 0.92;
        body.velocityY *= 0.92;
        body.x += body.velocityX * frame;
        body.y += body.velocityY * frame;

        const maxX = width - body.width - stagePadding;
        const maxY = height - body.height - stagePadding;

        if (body.x < stagePadding) {
          body.x = stagePadding;
          body.velocityX *= -0.65;
        } else if (body.x > maxX) {
          body.x = maxX;
          body.velocityX *= -0.65;
        }

        if (body.y < stagePadding) {
          body.y = stagePadding;
          body.velocityY *= -0.55;
        } else if (body.y > maxY) {
          body.y = maxY;
          body.velocityY *= -0.55;
        }
      });

      applyTransforms();
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      resizeObserver.disconnect();

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [visibleMessages]);

  const handlePointerDown = (
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const stage = stageRef.current;
    const body = bodiesRef.current[index];

    if (!stage || !body) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const maxX = stageSizeRef.current.width - body.width - stagePadding;
    const maxY = stageSizeRef.current.height - body.height - stagePadding;
    const localClientX = event.clientX - stageRect.left;
    const localClientY = event.clientY - stageRect.top;

    dragStateRef.current = {
      index,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastMoveAt: performance.now(),
      offsetX: localClientX - body.x,
      offsetY: localClientY - body.y,
      pointerId: event.pointerId,
      velocityX: 0,
      velocityY: 0,
    };

    body.x = clamp(localClientX - dragStateRef.current.offsetX, stagePadding, maxX);
    body.y = clamp(localClientY - dragStateRef.current.offsetY, stagePadding, maxY);
    body.velocityX = 0;
    body.velocityY = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.zIndex = "30";
    event.currentTarget.style.cursor = "grabbing";
    event.currentTarget.style.boxShadow = "0 32px 72px rgba(15, 17, 17, 0.22)";
    event.currentTarget.style.transform = `translate3d(${body.x}px, ${body.y}px, 0) scale(1.01)`;
  };

  const handlePointerMove = (
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const dragState = dragStateRef.current;
    const body = bodiesRef.current[index];
    const stage = stageRef.current;

    if (
      !dragState ||
      !stage ||
      !body ||
      dragState.index !== index ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const now = performance.now();
    const deltaTime = Math.max(now - dragState.lastMoveAt, 8);
    const maxX = stageSizeRef.current.width - body.width - stagePadding;
    const maxY = stageSizeRef.current.height - body.height - stagePadding;
    const localClientX = event.clientX - stageRect.left;
    const localClientY = event.clientY - stageRect.top;
    const nextX = clamp(localClientX - dragState.offsetX, stagePadding, maxX);
    const nextY = clamp(localClientY - dragState.offsetY, stagePadding, maxY);

    dragState.velocityX = ((event.clientX - dragState.lastClientX) / deltaTime) * 14;
    dragState.velocityY = ((event.clientY - dragState.lastClientY) / deltaTime) * 14;
    dragState.lastClientX = event.clientX;
    dragState.lastClientY = event.clientY;
    dragState.lastMoveAt = now;

    body.x = nextX;
    body.y = nextY;
    event.currentTarget.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(1.01)`;
  };

  const handlePointerRelease = (
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const dragState = dragStateRef.current;
    const body = bodiesRef.current[index];

    if (
      !dragState ||
      !body ||
      dragState.index !== index ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    body.velocityX = dragState.velocityX;
    body.velocityY = dragState.velocityY;
    body.anchorX = clamp(
      body.x + dragState.velocityX * 4,
      stagePadding,
      stageSizeRef.current.width - body.width - stagePadding,
    );
    body.anchorY = clamp(
      body.y + dragState.velocityY * 3,
      stagePadding,
      stageSizeRef.current.height - body.height - stagePadding,
    );
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.style.zIndex = "10";
    event.currentTarget.style.cursor = "grab";
    event.currentTarget.style.boxShadow = "";
  };

  return (
    <section className="relative min-h-[calc(100vh-7rem)] overflow-visible px-1 pb-10 pt-2 sm:px-2 sm:pt-2">
      <div className="relative z-10 flex flex-col gap-8">
        <header className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.26em] text-neutral-500">
                Floating room
              </p>
              <h1 className="mt-1 max-w-[12ch] text-[clamp(2.8rem,7vw,6.8rem)] font-semibold leading-[0.88] tracking-[-0.085em] text-neutral-950">
                {room.title}
              </h1>
            </div>

            <div className="flex flex-wrap gap-3 xl:max-w-[34rem] xl:justify-end">
              <StageBadge label="Status" value={room.status} />
              <StageBadge label="Category" value={room.category} />
              <StageBadge label="Closes" value={room.closesAtLabel} />
              <StageBadge label="Opened" value={room.openedAtLabel} />
              <StageBadge label="Members" value={String(room.members)} />
              <StageBadge label="Messages" value={String(room.messages)} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[48rem_minmax(0,1fr)] xl:items-start xl:gap-4">
            <div>
              <RoomProjectIntro blocks={room.projectOverview} />
            </div>

            <RoomHostBoard
              board={room.hostBoard}
              creatorName={room.creatorName}
              creatorRole={room.creatorRole}
            />
          </div>
        </header>

        <div
          ref={composerSentinelRef}
          className="relative z-20 pb-3 pt-1"
          style={{
            minHeight: composerHeight ? `${composerHeight + 16}px` : undefined,
          }}
        >
          <div
            ref={composerShellRef}
            className={
              isComposerPinned
                ? "fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-5"
                : "flex justify-center px-1"
            }
          >
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                aria-label={
                  isOwnMessagesFilterActive
                    ? "Show all room messages"
                    : "Show only your messages"
                }
                aria-pressed={isOwnMessagesFilterActive}
                onClick={() => {
                  setIsOwnMessagesFilterActive((current) => !current);
                }}
                className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full border text-[rgba(79,95,215,0.92)] shadow-[0_16px_30px_rgba(87,103,208,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition-[box-shadow,background-color,border-color,color,transform] duration-300 hover:-translate-y-0.5 ${
                  isOwnMessagesFilterActive
                    ? "border-[rgba(107,122,255,0.32)] bg-[linear-gradient(135deg,rgba(236,239,255,0.96),rgba(224,230,255,0.86))] text-[rgba(79,95,215,0.98)] shadow-[0_18px_34px_rgba(87,103,208,0.18),inset_0_1px_0_rgba(255,255,255,0.94)]"
                    : "border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(244,245,250,0.74))] text-neutral-500 hover:text-[rgba(79,95,215,0.92)]"
                }`}
              >
                <User size={18} strokeWidth={2} />
              </button>

              <div className="min-w-0 flex-1 basis-[22rem]">
                <FloatingCommentComposer category={room.category} roomId={room.id} />
              </div>

              <VpSortSlider
                mode={vpSortMode}
                onChange={setVpSortMode}
              />
            </div>
          </div>
        </div>

        <div
          ref={stageRef}
          className="relative overflow-visible"
          style={{ minHeight: `${stageHeight}px` }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="absolute left-1/2 top-6 aspect-[4/3] -translate-x-1/2 bg-[url('/subvote-village-scene.svg')] bg-contain bg-top bg-no-repeat opacity-[0.11]"
              style={{ width: "min(52rem, 72%)" }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0)_40%,rgba(255,250,245,0.1)_70%,rgba(255,250,245,0.36)_100%),linear-gradient(180deg,rgba(255,251,246,0.08)_0%,rgba(248,244,238,0.03)_44%,rgba(248,244,238,0.18)_76%,rgba(255,251,246,0.86)_100%)]" />
          </div>

          {visibleMessages.map(({ estimatedVpCost, message }, index) => (
            <div
              key={message.id}
              ref={(node) => {
                bubbleRefs.current[index] = node;
              }}
              onPointerCancel={(event) => {
                handlePointerRelease(index, event);
              }}
              onPointerDown={(event) => {
                handlePointerDown(index, event);
              }}
              onPointerMove={(event) => {
                handlePointerMove(index, event);
              }}
              onPointerUp={(event) => {
                handlePointerRelease(index, event);
              }}
              className={`absolute left-0 top-0 max-w-[22rem] cursor-grab select-none rounded-[1.75rem] px-4 py-4 shadow-[0_22px_56px_rgba(15,17,17,0.14)] backdrop-blur-md transition-[box-shadow,transform] duration-300 ease-out sm:px-5 sm:py-5 ${getBubbleToneClass(message.tone)}`}
              style={{ willChange: "transform", zIndex: 10 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-neutral-500/90">
                    {message.label}
                  </p>
                  <p className="mt-2 text-[1rem] font-semibold tracking-[-0.03em] text-neutral-950">
                    {message.author}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-right text-[0.72rem] font-medium uppercase tracking-[0.16em] text-neutral-500">
                    {message.time}
                  </p>
                  <span className="inline-flex min-h-8 items-center rounded-full border border-[rgba(111,127,255,0.18)] bg-[rgba(255,255,255,0.66)] px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgba(79,95,215,0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    {estimatedVpCost} VP
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[0.98rem] leading-7 text-neutral-700">
                {message.copy}
              </p>
            </div>
          ))}
          <div ref={loadTriggerRef} className="absolute inset-x-0 bottom-0 h-px" />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-[0.78rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
          <span>
            {isOwnMessagesFilterActive
              ? `${visibleMessages.length} of ${orderedMessages.length} personal bubbles visible`
              : `${visibleMessages.length} active bubbles in motion`}
          </span>
          <span>
            {vpSortMode === "low"
              ? "Lower VP spend appears first"
              : "Higher VP spend appears first"}
          </span>
          <span>{room.topicHash}</span>
        </footer>
      </div>
    </section>
  );
}

function StageBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[rgba(255,255,255,0.52)] px-3.5 py-2 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-neutral-700 shadow-[0_10px_24px_rgba(255,255,255,0.18),inset_0_1px_0_rgba(255,255,255,0.76)]">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-950">{value}</span>
    </span>
  );
}

function VpSortSlider({
  mode,
  onChange,
}: {
  mode: VpSortMode;
  onChange: (mode: VpSortMode) => void;
}) {
  const activeRatio = mode === "low" ? 0 : 1;
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const knobSize = 28;
  const displayRatio = dragRatio ?? activeRatio;

  const resolveRatioFromPointer = (
    clientX: number,
    rect: DOMRect,
  ) => {
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  const applyRatio = (nextRatio: number) => {
    setDragRatio(nextRatio);

    const nextMode = nextRatio < 0.5 ? "low" : "high";

    if (nextMode !== mode) {
      onChange(nextMode);
    }
  };

  return (
    <div className="w-[11.75rem] shrink-0 sm:w-[13.5rem]">
      <div className="px-3 py-4">
        <button
          type="button"
          role="slider"
          aria-label={
            mode === "low"
              ? "Switch to higher VP messages first"
              : "Switch to lower VP messages first"
          }
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={activeRatio}
          aria-valuetext={mode === "low" ? "Lower VP first" : "Higher VP first"}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              onChange("low");
            }

            if (event.key === "ArrowRight") {
              event.preventDefault();
              onChange("high");
            }
          }}
          onPointerDown={(event) => {
            activePointerIdRef.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            applyRatio(
              resolveRatioFromPointer(
                event.clientX,
                event.currentTarget.getBoundingClientRect(),
              ),
            );
          }}
          onPointerMove={(event) => {
            if (activePointerIdRef.current !== event.pointerId) {
              return;
            }

            applyRatio(
              resolveRatioFromPointer(
                event.clientX,
                event.currentTarget.getBoundingClientRect(),
              ),
            );
          }}
          onPointerUp={(event) => {
            if (activePointerIdRef.current !== event.pointerId) {
              return;
            }

            activePointerIdRef.current = null;
            setDragRatio(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (activePointerIdRef.current !== event.pointerId) {
              return;
            }

            activePointerIdRef.current = null;
            setDragRatio(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          className="group mt-3 block w-full cursor-grab rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(79,95,215,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,245,250,0.9)] active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <div className="relative h-11 rounded-full bg-[linear-gradient(90deg,rgba(228,236,255,0.92),rgba(255,255,255,0.82)_48%,rgba(255,229,214,0.82))] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="absolute left-5 right-5 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(79,95,215,0.3),rgba(79,95,215,0.12),rgba(244,114,182,0.22))]" />
            <div
              className={`pointer-events-none absolute top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(107,122,255,0.32)] bg-[linear-gradient(135deg,rgba(236,239,255,0.98),rgba(221,229,255,0.9))] text-[rgba(79,95,215,0.98)] shadow-[0_10px_22px_rgba(87,103,208,0.16),inset_0_1px_0_rgba(255,255,255,0.96)] transition-[left] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                dragRatio === null ? "duration-300" : "duration-0"
              }`}
              style={{
                left: `calc(0.75rem + ${displayRatio * 100}% - ${displayRatio * (24 + knobSize)}px)`,
              }}
            >
              <span className="size-1.5 rounded-full bg-current" />
            </div>
          </div>
        </button>

        <div className="mt-3 flex items-start justify-between gap-3 text-[0.66rem] font-medium tracking-[-0.02em] text-neutral-500">
          <button
            type="button"
            onClick={() => {
              onChange("low");
            }}
            className={`text-left transition-colors duration-200 ${
              mode === "low" ? "text-[rgba(79,95,215,0.98)]" : ""
            }`}
          >
            VP cheaper
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("high");
            }}
            className={`text-right transition-colors duration-200 ${
              mode === "high" ? "text-[rgba(79,95,215,0.98)]" : ""
            }`}
          >
            VP heavier
          </button>
        </div>
      </div>
    </div>
  );
}

function getBubbleToneClass(tone: FloatingRoomMessage["tone"]) {
  if (tone === "host") {
    return "bg-[rgba(255,243,212,0.76)]";
  }

  if (tone === "self") {
    return "bg-[rgba(223,239,255,0.78)]";
  }

  if (tone === "system") {
    return "bg-[rgba(241,244,236,0.78)]";
  }

  return "bg-[rgba(255,255,255,0.7)]";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function seededUnit(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

function getShortestColumnIndex(columnHeights: number[]) {
  let shortestIndex = 0;

  for (let index = 1; index < columnHeights.length; index += 1) {
    if (columnHeights[index]! < columnHeights[shortestIndex]!) {
      shortestIndex = index;
    }
  }

  return shortestIndex;
}

function getBaseMessageVpCost(category: SquareRoom["category"]) {
  return category === "OpenGov" ? 8 : 5;
}

function getEstimatedMessageVpCost(
  category: SquareRoom["category"],
  copy: string,
) {
  const baseCost = getBaseMessageVpCost(category);
  const lengthSurcharge = Math.max(0, Math.ceil(copy.trim().length / 72) - 1);

  return baseCost + lengthSurcharge;
}
