"use client";

import { useState } from "react";

import { TintMark, UnderlineMark } from "@/app/app/_components/text-marks";

const PRESET_PERCENTAGES = [25, 50, 75, 100] as const;
const MAGNET_RADIUS = 10;
const MAGNET_EXPONENT = 2.2;

const stakeSessions = [
  {
    id: "dot-to-vdot",
    accent: "sky",
    badge: "Session 01",
    eyebrow: "DOT -> Bifrost vDOT",
    title: "Convert DOT into liquid staking vDOT",
    copy: (
      <>
        Start with <TintMark tone="sky">DOT</TintMark>, route it through{" "}
        <UnderlineMark tone="rose">Bifrost</UnderlineMark>, and receive{" "}
        <TintMark tone="sky">vDOT</TintMark> as the liquid staking position you
        carry forward.
      </>
    ),
    primaryBalance: {
      label: "DOT balance",
      placeholder: "128.40 DOT",
    },
    secondaryBalance: {
      label: "vDOT balance",
      placeholder: "84.26 vDOT",
    },
    availableBalance: 128.4,
    inputLabel: "Amount to convert",
    inputSymbol: "DOT",
    inputPlaceholder: "0.00",
    estimateLabel: "Estimated vDOT",
    estimatePlaceholder: "--.-- vDOT",
    quotePlaceholder: "Placeholder Bifrost quote",
    cta: "Convert to vDOT",
    notes: ["Liquid staking route", "Yield stays on the vDOT side"],
  },
  {
    id: "vdot-to-vp",
    accent: "amber",
    badge: "Session 02",
    eyebrow: "Bifrost vDOT -> VP",
    title: "Stake vDOT and sync usable VP",
    copy: (
      <>
        Deposit <TintMark tone="sky">vDOT</TintMark> into the staking contract.
        subvote then syncs the position and credits{" "}
        <TintMark tone="amber">VP</TintMark> as app-side participation power.
      </>
    ),
    primaryBalance: {
      label: "vDOT balance",
      placeholder: "84.26 vDOT",
    },
    secondaryBalance: {
      label: "VP balance",
      placeholder: "1,920 VP",
    },
    availableBalance: 84.26,
    inputLabel: "Amount to stake",
    inputSymbol: "vDOT",
    inputPlaceholder: "0.00",
    estimateLabel: "Estimated VP",
    estimatePlaceholder: "-- VP",
    quotePlaceholder: "Placeholder VP sync preview",
    cta: "Stake for VP",
    notes: ["VP is not transferable", "Conversation power stays app-side"],
  },
] as const;

export function GetVpStakePanels() {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {stakeSessions.map((session, index) => (
        <StakeSessionCard
          key={session.id}
          accent={session.accent}
          availableBalance={session.availableBalance}
          badge={session.badge}
          copy={session.copy}
          cta={session.cta}
          estimateLabel={session.estimateLabel}
          estimatePlaceholder={session.estimatePlaceholder}
          eyebrow={session.eyebrow}
          index={index}
          inputLabel={session.inputLabel}
          inputPlaceholder={session.inputPlaceholder}
          inputSymbol={session.inputSymbol}
          notes={session.notes}
          primaryBalance={session.primaryBalance}
          quotePlaceholder={session.quotePlaceholder}
          secondaryBalance={session.secondaryBalance}
          title={session.title}
        />
      ))}
    </div>
  );
}

function StakeSessionCard({
  accent,
  availableBalance,
  badge,
  copy,
  cta,
  estimateLabel,
  estimatePlaceholder,
  eyebrow,
  index,
  inputLabel,
  inputPlaceholder,
  inputSymbol,
  notes,
  primaryBalance,
  quotePlaceholder,
  secondaryBalance,
  title,
}: {
  accent: "amber" | "sky";
  availableBalance: number;
  badge: string;
  copy: React.ReactNode;
  cta: string;
  estimateLabel: string;
  estimatePlaceholder: string;
  eyebrow: string;
  index: number;
  inputLabel: string;
  inputPlaceholder: string;
  inputSymbol: string;
  notes: readonly string[];
  primaryBalance: {
    label: string;
    placeholder: string;
  };
  quotePlaceholder: string;
  secondaryBalance: {
    label: string;
    placeholder: string;
  };
  title: string;
}) {
  const [amountInput, setAmountInput] = useState("");

  const accentMap = {
    amber: {
      glow: "bg-[radial-gradient(circle,rgba(252,211,77,0.22),rgba(255,255,255,0))]",
      pill: "bg-[rgba(252,211,77,0.18)] text-neutral-700 shadow-[inset_0_-1px_0_rgba(252,211,77,0.24)]",
      rail: "from-[rgba(252,211,77,0.38)] to-[rgba(252,211,77,0)]",
      slider:
        "from-[rgba(252,211,77,0.88)] via-[rgba(252,211,77,0.5)] to-[rgba(252,211,77,0.12)]",
      markerActive: "border-amber-300 bg-amber-100/88 text-amber-900",
      markerIdle: "border-black/8 bg-white/64 text-neutral-500",
      focus:
        "focus-visible:ring-amber-300/45 focus-visible:ring-offset-[rgba(243,239,230,0.96)]",
    },
    sky: {
      glow: "bg-[radial-gradient(circle,rgba(191,219,254,0.26),rgba(255,255,255,0))]",
      pill: "bg-[rgba(191,219,254,0.26)] text-slate-700 shadow-[inset_0_-1px_0_rgba(125,211,252,0.24)]",
      rail: "from-[rgba(191,219,254,0.46)] to-[rgba(191,219,254,0)]",
      slider:
        "from-[rgba(125,211,252,0.9)] via-[rgba(191,219,254,0.58)] to-[rgba(191,219,254,0.14)]",
      markerActive: "border-sky-300 bg-sky-100/88 text-sky-900",
      markerIdle: "border-black/8 bg-white/64 text-neutral-500",
      focus:
        "focus-visible:ring-sky-300/45 focus-visible:ring-offset-[rgba(243,239,230,0.96)]",
    },
  } as const;

  const accentClasses = accentMap[accent];
  const parsedAmount = sanitizeAmount(amountInput);
  const boundedAmount = clamp(parsedAmount, 0, availableBalance);
  const sliderValue =
    availableBalance > 0 ? (boundedAmount / availableBalance) * 100 : 0;
  const activePreset = getActivePreset(sliderValue);
  const hasCustomAmount = amountInput.trim().length > 0;

  function handleInputChange(rawValue: string) {
    if (rawValue === "") {
      setAmountInput("");
      return;
    }

    const normalized = normalizeDecimalInput(rawValue);

    if (normalized === null) {
      return;
    }

    setAmountInput(normalized);
  }

  function applyPreset(percentage: number) {
    const nextAmount = formatEditableAmount(
      (availableBalance * percentage) / 100,
      availableBalance,
    );
    setAmountInput(nextAmount);
  }

  function handleSliderChange(value: string) {
    const rawPercentage = clamp(Number(value), 0, 100);
    const nextPercentage = applyMagneticResistance(rawPercentage);
    const nextAmount = formatEditableAmount(
      (availableBalance * nextPercentage) / 100,
      availableBalance,
    );
    setAmountInput(nextAmount);
  }

  const sliderPosition = invertMagneticResistance(sliderValue);

  return (
    <article
      className="border-black/8 group relative overflow-hidden rounded-[2rem] border bg-[linear-gradient(160deg,rgba(255,255,255,0.86),rgba(245,241,234,0.82))] p-5 shadow-[0_24px_60px_rgba(15,17,17,0.07),inset_0_1px_0_rgba(255,255,255,0.84)] sm:p-6"
      style={{
        animation:
          "landing-fade-up 760ms cubic-bezier(0.18, 0.88, 0.22, 1) both",
        animationDelay: `${180 + index * 110}ms`,
      }}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-[18%] top-0 h-28 rounded-full blur-2xl ${accentClasses.glow}`}
      />
      <div
        aria-hidden="true"
        className={`absolute left-0 top-0 h-full w-24 bg-gradient-to-r ${accentClasses.rail}`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
              {badge}
            </p>
            <p className="mt-2 font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
              {eyebrow}
            </p>
          </div>

          <span
            className={`inline-flex rounded-full px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] ${accentClasses.pill}`}
          >
            Ready flow
          </span>
        </div>

        <h2 className="mt-5 max-w-[15ch] text-[clamp(1.8rem,3vw,2.5rem)] font-normal leading-[0.96] tracking-[-0.06em] text-neutral-950">
          {title}
        </h2>
        <p className="mt-4 max-w-[42rem] text-[0.98rem] leading-7 text-neutral-600">
          {copy}
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <BalanceBadge
            label={primaryBalance.label}
            placeholder={primaryBalance.placeholder}
          />
          <BalanceBadge
            label={secondaryBalance.label}
            placeholder={secondaryBalance.placeholder}
          />
        </div>

        <div className="border-black/8 mt-6 rounded-[1.6rem] border bg-[rgba(250,247,241,0.88)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="border-black/8 bg-white/78 rounded-[1.3rem] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <span className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  {inputLabel}
                </span>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <input
                    value={amountInput}
                    onChange={(event) => handleInputChange(event.target.value)}
                    inputMode="decimal"
                    placeholder={inputPlaceholder}
                    className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[1.7rem] font-semibold leading-none tracking-[-0.06em] text-neutral-950 outline-none placeholder:text-neutral-300 focus-visible:ring-0`}
                  />
                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] ${accentClasses.pill}`}
                  >
                    {inputSymbol}
                  </span>
                </div>
              </label>

              <div className="border-black/8 bg-white/62 rounded-[1.3rem] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <p className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Input mode
                </p>
                <p className="mt-2 text-base font-semibold tracking-[-0.03em] text-neutral-950">
                  {activePreset ? `On ${activePreset}% preset` : "Custom amount"}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Drag freely or enter a precise amount manually. Presets only
                  add resistance nearby.
                </p>
              </div>
            </div>

            <div className="border-black/8 rounded-[1.35rem] border bg-white/60 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Allocation slider
                </p>
                <p className="text-[0.74rem] font-medium uppercase tracking-[0.18em] text-neutral-400">
                  Magnetic presets
                </p>
              </div>

              <div className="mt-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[rgba(15,17,17,0.06)]" />
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r ${accentClasses.slider}`}
                    style={{ width: `${sliderValue}%` }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-950 shadow-[0_8px_16px_rgba(15,17,17,0.16)]"
                    style={{ left: `${sliderValue}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={sliderPosition}
                    onChange={(event) => handleSliderChange(event.target.value)}
                    aria-label={`${title} allocation slider`}
                    className={`relative z-20 h-5 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:shadow-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none ${accentClasses.focus} focus-visible:ring-2 focus-visible:ring-offset-2`}
                  />
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {PRESET_PERCENTAGES.map((percentage) => {
                    const isActive = activePreset === percentage;
                    return (
                      <button
                        key={percentage}
                        type="button"
                        onClick={() => applyPreset(percentage)}
                        className={`rounded-full border px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.16em] transition-[transform,border-color,background-color,color] duration-200 hover:-translate-y-0.5 ${isActive ? accentClasses.markerActive : accentClasses.markerIdle}`}
                      >
                        {percentage}%
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PreviewCard
                hint={hasCustomAmount ? "Input preview" : "Waiting for input"}
                label={`You send (${inputSymbol})`}
                value={
                  hasCustomAmount
                    ? `${formatPreviewAmount(boundedAmount)} ${inputSymbol}`
                    : `-- ${inputSymbol}`
                }
              />
              <PreviewCard
                hint={quotePlaceholder}
                label={estimateLabel}
                value={estimatePlaceholder}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {notes.map((note) => (
            <span
              key={note}
              className="border-black/8 bg-white/64 inline-flex items-center rounded-full border px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
            >
              {note}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-[30rem] text-sm leading-6 text-neutral-500">
            Hook the wallet balance, quote response, allowance check, and
            contract submit state into this panel later. The layout is already
            separated for those remote actions.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-[1.2rem] border border-neutral-950 bg-neutral-950 px-4 text-sm font-semibold text-white opacity-90 shadow-[0_16px_30px_rgba(15,17,17,0.16)]"
          >
            {cta}
          </button>
        </div>
      </div>
    </article>
  );
}

function BalanceBadge({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <div className="border-black/8 inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1.5 text-[0.72rem] font-medium tracking-[0.02em] text-neutral-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <span className="uppercase tracking-[0.16em] text-neutral-400">
        {label}
      </span>
      <span className="text-neutral-900">{placeholder}</span>
    </div>
  );
}

function PreviewCard({
  hint,
  label,
  value,
}: {
  hint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="border-black/8 bg-white/68 rounded-[1.25rem] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <p className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-[1.08rem] font-semibold tracking-[-0.04em] text-neutral-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{hint}</p>
    </div>
  );
}

function sanitizeAmount(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeDecimalInput(value: string) {
  if (!/^\d*\.?\d*$/.test(value)) {
    return null;
  }

  const [whole = "", fraction = ""] = value.split(".");
  return fraction.length > 4 ? `${whole}.${fraction.slice(0, 4)}` : value;
}

function applyMagneticResistance(value: number) {
  const boundedValue = clamp(value, 0, 100);
  const preset = getNearestPresetInRange(boundedValue);

  if (preset === null) {
    return boundedValue;
  }

  const distance = boundedValue - preset;
  const normalizedDistance = Math.abs(distance) / MAGNET_RADIUS;
  const compressedDistance =
    MAGNET_RADIUS * normalizedDistance ** MAGNET_EXPONENT;

  return clamp(
    preset + Math.sign(distance) * compressedDistance,
    0,
    100,
  );
}

function invertMagneticResistance(value: number) {
  const boundedValue = clamp(value, 0, 100);
  const preset = getNearestPresetInRange(boundedValue);

  if (preset === null) {
    return boundedValue;
  }

  const distance = boundedValue - preset;
  const normalizedDistance = Math.abs(distance) / MAGNET_RADIUS;
  const expandedDistance =
    MAGNET_RADIUS * normalizedDistance ** (1 / MAGNET_EXPONENT);

  return clamp(
    preset + Math.sign(distance) * expandedDistance,
    0,
    100,
  );
}

function getNearestPresetInRange(value: number) {
  const preset =
    PRESET_PERCENTAGES.find(
      (candidate) => Math.abs(candidate - value) <= MAGNET_RADIUS,
    ) ?? null;

  return preset;
}

function getActivePreset(value: number) {
  return (
    PRESET_PERCENTAGES.find((preset) => Math.abs(preset - value) < 0.2) ?? null
  );
}

function formatEditableAmount(value: number, availableBalance: number) {
  if (value === availableBalance) {
    return availableBalance.toFixed(4).replace(/\.?0+$/, "");
  }

  return value.toFixed(4).replace(/\.?0+$/, "");
}

function formatPreviewAmount(value: number) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  });
}
