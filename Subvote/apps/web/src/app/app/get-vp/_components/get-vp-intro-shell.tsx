"use client";

import {
  type ReactNode,
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { GetVpStakeHistory } from "@/app/app/get-vp/_components/get-vp-stake-history";
import { GetVpStakePanels } from "@/app/app/get-vp/_components/get-vp-stake-panels";

export function GetVpIntroShell({ details }: { details: ReactNode }) {
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
    <div className="mx-auto flex min-h-full w-full max-w-none flex-col px-0 pb-14">
      <section className="px-1 pt-1 sm:px-2">
        <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
          Get VP
        </p>

        <button
          type="button"
          onClick={handleToggle}
          aria-controls={detailsId}
          aria-expanded={isOpen}
          aria-label={
            isOpen
              ? "Collapse Get VP introduction"
              : "Expand Get VP introduction"
          }
          className="border-black/8 hover:border-black/12 mt-5 flex w-full flex-col gap-4 rounded-[1.8rem] border bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(244,239,231,0.78))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(15,17,17,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,17,17,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] sm:px-5 sm:py-5"
          style={{
            animation:
              "landing-fade-up 760ms cubic-bezier(0.18, 0.88, 0.22, 1) both",
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                {isOpen ? "Introduction open" : "Introduction folded"}
              </p>
              <p className="mt-2 max-w-3xl text-[1rem] leading-7 text-neutral-600 sm:text-[1.04rem]">
                {isOpen
                  ? "Tap anywhere on this introduction panel to fold the full Get VP overview back into its compact state."
                  : "Tap anywhere on this introduction panel to unfold the full Get VP overview, including the staking flow, VP formula, and app-side participation notes."}
              </p>
            </div>

            <div className="border-black/8 bg-white/72 flex items-center gap-2 self-start rounded-full border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  isOpen ? "bg-emerald-400" : "bg-neutral-300"
                }`}
              />
              {isOpen ? "Expanded" : "Collapsed"}
            </div>
          </div>
        </button>
      </section>

      <section
        ref={detailsRef}
        id={detailsId}
        aria-hidden={!isOpen}
        className="scroll-mt-6 px-0 pt-6 sm:scroll-mt-8 sm:pt-8"
      >
        <div
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div
            className={`overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-4 opacity-0"
            }`}
          >
            {details}
          </div>
        </div>
      </section>

      <section className="px-1 pt-5 sm:px-2">
        <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
          Stake
        </p>

        <GetVpStakePanels />
        <GetVpStakeHistory />
      </section>
    </div>
  );
}
