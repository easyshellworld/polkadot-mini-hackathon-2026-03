import type { ReactNode } from "react";

import { ExpandablePanel } from "./expandable-panel";

import type { RoomHostBoard } from "@/app/app/_lib/mock-rooms";

type RoomHostBoardProps = {
  board: RoomHostBoard;
  creatorName: string;
  creatorRole: string;
};

export function RoomHostBoard({
  board,
  creatorName,
  creatorRole,
}: RoomHostBoardProps) {
  return (
    <aside className="mt-4">
      <ExpandablePanel
        expandLabel="Expand host board"
        collapseLabel="Collapse host board"
        header={
          <div className="flex items-center justify-between gap-3 px-2">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
              Host chat
            </p>
            <span className="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
              {board.updatedAtLabel}
            </span>
          </div>
        }
        panelClassName="px-2 py-2"
        contentAreaClassName="px-1 py-2"
        viewportClassName="px-1 pr-3"
        contentClassName="space-y-5"
      >
          <div className="relative pl-[4.5rem] pt-1">
            <span className="absolute left-0 top-0 flex size-12 items-center justify-center rounded-full bg-neutral-950 text-[0.92rem] font-semibold uppercase tracking-[0.12em] text-white">
              {getInitials(creatorName)}
            </span>

            <ChatBubble
              metaLabel={board.updatedAtLabel}
              title={board.headline}
              tone="highlight"
              withTail
              widthClassName="w-full"
              tailClassName="left-[-0.38rem] top-4"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-[0.98rem] font-semibold tracking-[-0.03em] text-neutral-950">
                    {creatorName}
                  </p>
                  <p className="mt-1 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    {creatorRole}
                  </p>
                </div>

                <p className="text-[0.98rem] leading-7 text-neutral-700">
                  {board.note}
                </p>
              </div>
            </ChatBubble>
          </div>

          <div className="pl-[4.5rem] pr-2">
            <ChatBubble
              metaLabel="Current ask"
              tone="paper"
              widthClassName="max-w-[84%]"
            >
              <p className="text-[0.95rem] leading-7 text-neutral-700">
                {board.currentAsk}
              </p>
            </ChatBubble>
          </div>

          <div className="pl-[4.5rem] pr-6">
            <ChatBubble
              metaLabel="What changed"
              tone="mist"
              widthClassName="max-w-[80%]"
            >
              <p className="text-[0.93rem] leading-6 text-neutral-700">
                {board.latestShift}
              </p>
            </ChatBubble>
          </div>

          <div className="pl-[4.5rem] pr-3">
            <ChatBubble
              metaLabel="Open risks"
              tone="paper"
              widthClassName="max-w-[86%]"
            >
              <ul className="space-y-2.5 text-[0.91rem] leading-6 text-neutral-700">
                {board.openRisks.map((risk) => (
                  <li key={risk} className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-950/70" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </ChatBubble>
          </div>
      </ExpandablePanel>
    </aside>
  );
}

function ChatBubble({
  children,
  metaLabel,
  title,
  tone = "highlight",
  withTail = false,
  widthClassName = "max-w-[92%]",
  tailClassName = "-left-1 top-6",
}: {
  children: ReactNode;
  metaLabel: string;
  title?: string;
  tone?: "highlight" | "mist" | "paper";
  withTail?: boolean;
  widthClassName?: string;
  tailClassName?: string;
}) {
  const toneClassName =
    tone === "highlight"
      ? "bg-[rgba(255,244,214,0.84)]"
      : tone === "mist"
        ? "bg-[rgba(232,238,244,0.88)]"
        : "bg-[rgba(255,255,255,0.92)]";

  return (
    <div
      className={`relative ${widthClassName} rounded-[1.6rem] px-5 py-4 shadow-[0_12px_28px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.72)] ${toneClassName}`}
    >
      {withTail ? (
        <span
          aria-hidden="true"
          className={`absolute size-3 rotate-45 rounded-[0.18rem] ${tailClassName} ${toneClassName}`}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
          {metaLabel}
        </p>
        <span className="text-[0.66rem] font-medium uppercase tracking-[0.16em] text-neutral-400">
          Delivered
        </span>
      </div>

      {title ? (
        <h2 className="mt-2 text-[1.14rem] font-semibold leading-[1.08] tracking-[-0.05em] text-neutral-950">
          {title}
        </h2>
      ) : null}

      <div className={title ? "mt-3" : "mt-2.5"}>{children}</div>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "SB";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
