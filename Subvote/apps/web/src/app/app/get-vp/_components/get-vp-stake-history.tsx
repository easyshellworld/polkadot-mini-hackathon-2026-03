"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";

const historyItems = [
  {
    id: "hst-001",
    kind: "DOT -> vDOT",
    amount: "24.00 DOT",
    outcome: "23.81 vDOT",
    status: "Completed",
    timestamp: "Today, 14:32",
    tx: "0x7f2a...91c4",
  },
  {
    id: "hst-002",
    kind: "vDOT -> VP",
    amount: "18.50 vDOT",
    outcome: "1,360 VP",
    status: "Synced",
    timestamp: "Today, 14:36",
    tx: "0x2ad1...4bb8",
  },
  {
    id: "hst-003",
    kind: "DOT -> vDOT",
    amount: "60.00 DOT",
    outcome: "59.21 vDOT",
    status: "Completed",
    timestamp: "Yesterday, 20:18",
    tx: "0x18ce...0aa2",
  },
  {
    id: "hst-004",
    kind: "vDOT -> VP",
    amount: "40.00 vDOT",
    outcome: "2,000 VP",
    status: "Pending sync",
    timestamp: "Yesterday, 20:24",
    tx: "0x9c44...e7f3",
  },
] as const;

export function GetVpStakeHistory() {
  const detailsId = useId();
  const detailsRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  function handleToggle() {
    startTransition(() => {
      setIsOpen((open) => !open);
    });
  }

  return (
    <section className="mt-8">
      <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
        History
      </p>

      <button
        type="button"
        onClick={handleToggle}
        aria-controls={detailsId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Collapse history ledger" : "Expand history ledger"}
        className="border-black/8 hover:border-black/12 mt-5 flex w-full flex-col gap-4 rounded-[1.8rem] border bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(244,239,231,0.78))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(15,17,17,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,17,17,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] sm:px-5 sm:py-5"
        style={{
          animation:
            "landing-fade-up 760ms cubic-bezier(0.18, 0.88, 0.22, 1) both",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
              {isOpen ? "History open" : "History folded"}
            </p>
            <p className="mt-2 max-w-3xl text-[1rem] leading-7 text-neutral-600 sm:text-[1.04rem]">
              {isOpen
                ? "Tap anywhere on this history panel to fold the recent convert and stake ledger back into its compact state."
                : "Tap anywhere on this history panel to unfold the latest convert and stake records, including route, amount, result, status, and timestamp."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <HistoryMeta value="4 records" />
            <HistoryMeta value="2 routes" />
            <span className="border-black/8 bg-white/72 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  isOpen ? "bg-emerald-400" : "bg-neutral-300"
                }`}
              />
              {isOpen ? "Expanded" : "Collapsed"}
            </span>
          </div>
        </div>
      </button>

      <section
        ref={detailsRef}
        id={detailsId}
        aria-hidden={!isOpen}
        className="scroll-mt-6 px-0 pt-4 sm:scroll-mt-8 sm:pt-5"
      >
        <div
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <article
            className={`overflow-hidden rounded-[1.9rem] border border-black/8 bg-[linear-gradient(160deg,rgba(255,255,255,0.84),rgba(245,241,234,0.8))] shadow-[0_20px_54px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.82)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-4 opacity-0"
            }`}
          >
            <div className="border-black/8 grid gap-2 border-b bg-[rgba(255,255,255,0.54)] px-4 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto] sm:items-center sm:px-5">
              <div>
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  Stake ledger
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Route, amount, result, status, and timestamp in one compact
                  pass.
                </p>
              </div>

          <div className="grid w-full grid-cols-2 place-items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-400">
            <div className="w-full px-3 text-center">Input</div>
            <div className="w-full px-3 text-center">Result</div>
              </div>

              <span className="border-black/8 bg-white/72 inline-flex items-center justify-center self-start rounded-full border px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:self-center">
                Latest first
              </span>
            </div>

            <div className="divide-black/6 divide-y">
              {historyItems.map((item, index) => (
                <HistoryRow key={item.id} item={item} index={index} />
              ))}
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}

function HistoryRow({
  item,
  index,
}: {
  item: (typeof historyItems)[number];
  index: number;
}) {
  const statusClass =
    item.status === "Pending sync"
      ? "bg-[rgba(252,211,77,0.18)] text-amber-900 shadow-[inset_0_-1px_0_rgba(252,211,77,0.22)]"
      : item.status === "Synced"
        ? "bg-[rgba(191,219,254,0.24)] text-sky-900 shadow-[inset_0_-1px_0_rgba(125,211,252,0.22)]"
        : "bg-[rgba(167,243,208,0.22)] text-emerald-900 shadow-[inset_0_-1px_0_rgba(110,231,183,0.2)]";

  return (
    <div
      className="hover:bg-white/42 grid gap-3 px-4 py-4 transition-colors duration-200 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto] sm:items-center sm:px-5"
      style={{
        animation:
          "landing-fade-up 620ms cubic-bezier(0.18, 0.88, 0.22, 1) both",
        animationDelay: `${220 + index * 70}ms`,
      }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold tracking-[-0.03em] text-neutral-950">
            {item.kind}
          </p>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[0.66rem] font-medium uppercase tracking-[0.14em] ${statusClass}`}
          >
            {item.status}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6 text-neutral-500">
          <span>{item.timestamp}</span>
          <span className="text-neutral-300">•</span>
          <span className="font-mono text-[0.76rem] tracking-[-0.02em] text-neutral-400">
            {item.tx}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm leading-6 text-neutral-600">
        <div className="border-black/8 rounded-[1rem] border bg-white/60 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <p className="font-semibold text-neutral-950">{item.amount}</p>
        </div>
        <div className="border-black/8 rounded-[1rem] border bg-white/60 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <p className="font-semibold text-neutral-950">{item.outcome}</p>
        </div>
      </div>

      <button
        type="button"
        className="border-black/8 bg-white/72 inline-flex h-10 shrink-0 items-center justify-center rounded-[1rem] border px-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white"
      >
        View
      </button>
    </div>
  );
}

function HistoryMeta({ value }: { value: string }) {
  return (
    <span className="border-black/8 bg-white/68 inline-flex items-center rounded-full border px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      {value}
    </span>
  );
}
