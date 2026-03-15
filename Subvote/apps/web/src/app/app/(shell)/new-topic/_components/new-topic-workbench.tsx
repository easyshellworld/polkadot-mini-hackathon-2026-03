"use client";

import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Gift,
  Layers3,
  MessageSquare,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import {
  type ReactNode,
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { TintMark, UnderlineMark } from "@/app/app/_components/text-marks";
import { type TopicCategory } from "@/app/app/_lib/mock-rooms";

const LOCAL_STORAGE_KEY = "subvote:new-topic-studio:v2";

type RewardType = "bounty_pool" | "follow_up" | "recognition" | "vp_bonus";
type PublishedTopicStatus = "ended" | "live";

type BoardEntry = {
  author: string;
  copy: string;
  id: string;
  timeLabel: string;
};

type DraftState = {
  boardEntries: BoardEntry[];
  category: TopicCategory;
  endAt: string;
  isOpenGov: boolean;
  referendumId: string;
  rewardType: RewardType | "";
  summary: string;
  title: string;
  track: string;
};

type PublishedTopic = {
  boardEntries: BoardEntry[];
  category: TopicCategory;
  endAt: string;
  id: string;
  isOpenGov: boolean;
  referendumId: string;
  rewardIssued: boolean;
  rewardIssuedLabel: string | null;
  rewardType: RewardType;
  status: PublishedTopicStatus;
  summary: string;
  title: string;
  track: string;
};

type SaveStatus = "idle" | "saved" | "saving";
type FeedbackTone = "neutral" | "success" | "warning";

const categoryOptions: readonly {
  copy: string;
  id: TopicCategory;
  tone: string;
}[] = [
  {
    id: "OpenGov",
    copy: "Referenda, governance tracks, and public decision framing.",
    tone: "border-sky-300/80 bg-[rgba(219,234,254,0.84)] text-sky-950 shadow-[0_16px_34px_rgba(59,130,246,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
  },
  {
    id: "Treasury",
    copy: "Funding asks, execution pressure, and follow-through review.",
    tone: "border-amber-300/75 bg-[rgba(254,243,199,0.84)] text-amber-950 shadow-[0_16px_34px_rgba(245,158,11,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
  },
  {
    id: "Protocol",
    copy: "Runtime, tooling, release risk, and operator-facing decisions.",
    tone: "border-violet-300/70 bg-[rgba(237,233,254,0.8)] text-violet-950 shadow-[0_16px_34px_rgba(139,92,246,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
  },
  {
    id: "Community",
    copy: "Coordination, grants, participation, and public narrative.",
    tone: "border-rose-300/70 bg-[rgba(251,226,234,0.82)] text-rose-950 shadow-[0_16px_34px_rgba(244,114,182,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
  },
  {
    id: "Operations",
    copy: "Execution logs, rollout friction, and service reliability.",
    tone: "border-emerald-300/70 bg-[rgba(209,250,229,0.82)] text-emerald-950 shadow-[0_16px_34px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
  },
] as const;

const openGovTrackSuggestions = [
  "Root",
  "Treasurer",
  "Wish-For-Change",
] as const;

const rewardOptions: readonly {
  copy: string;
  id: RewardType;
  label: string;
  tone: string;
}[] = [
  {
    id: "vp_bonus",
    label: "VP bonus",
    copy: "Post-close VP reward for the strongest room contribution.",
    tone: "border-amber-300/70 bg-[rgba(254,243,199,0.82)] text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]",
  },
  {
    id: "recognition",
    label: "Recognition",
    copy: "No transfer, but the closing note records a public winner.",
    tone: "border-sky-300/70 bg-[rgba(219,234,254,0.82)] text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]",
  },
  {
    id: "follow_up",
    label: "Follow-up slot",
    copy: "Winning message earns a dedicated next-step thread.",
    tone: "border-violet-300/70 bg-[rgba(237,233,254,0.82)] text-violet-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]",
  },
  {
    id: "bounty_pool",
    label: "Bounty pool",
    copy: "Mark the topic for a manual reward review after close.",
    tone: "border-emerald-300/70 bg-[rgba(209,250,229,0.82)] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]",
  },
] as const;

const defaultDraft: DraftState = {
  boardEntries: [],
  category: "Community",
  endAt: "",
  isOpenGov: false,
  referendumId: "",
  rewardType: "",
  summary: "",
  title: "",
  track: "",
};

const seedPublishedTopics: PublishedTopic[] = [
  {
    boardEntries: [
      {
        author: "Host",
        copy: "Archive decision: summarize the delegate concerns into one closing note before rewards are released.",
        id: "delegate-retro-note-1",
        timeLabel: "03/06 16:20",
      },
      {
        author: "Moderator",
        copy: "Two contributors narrowed the failure pattern to framing, not execution.",
        id: "delegate-retro-note-2",
        timeLabel: "03/06 18:10",
      },
    ],
    category: "OpenGov",
    endAt: "2026-03-06T20:00",
    id: "delegate-retro",
    isOpenGov: true,
    referendumId: "Ref #403",
    rewardIssued: true,
    rewardIssuedLabel: "03/07 09:40",
    rewardType: "recognition",
    status: "ended",
    summary:
      "A closed room reviewing why the last referendum discussion failed to converge before voting.",
    title: "Delegate retrospective on failed referenda",
    track: "Wish-For-Change",
  },
  {
    boardEntries: [
      {
        author: "Host",
        copy: "Collect the first-run friction before the next validator onboarding cohort starts.",
        id: "validator-note-1",
        timeLabel: "03/12 11:05",
      },
    ],
    category: "Operations",
    endAt: "2026-03-18T18:00",
    id: "validator-onboarding",
    isOpenGov: false,
    referendumId: "",
    rewardIssued: false,
    rewardIssuedLabel: null,
    rewardType: "follow_up",
    status: "live",
    summary:
      "An active room collecting operator friction from first-time validator onboarding.",
    title: "Validator onboarding feedback room",
    track: "",
  },
  {
    boardEntries: [
      {
        author: "Host",
        copy: "Topic closed. Reward review should favor evidence about actual route depth, not just sentiment.",
        id: "treasury-note-1",
        timeLabel: "03/10 17:30",
      },
    ],
    category: "OpenGov",
    endAt: "2026-03-10T15:00",
    id: "treasury-liquidity",
    isOpenGov: true,
    referendumId: "Ref #418",
    rewardIssued: false,
    rewardIssuedLabel: null,
    rewardType: "vp_bonus",
    status: "ended",
    summary:
      "A completed governance room on liquidity incentives and the evidence needed to justify extension.",
    title: "Treasury track liquidity incentives",
    track: "Treasurer",
  },
];

export function NewTopicWorkbench() {
  const introId = useId();
  const historyId = useId();
  const introRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<HTMLElement | null>(null);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(defaultDraft);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [draftBoardComposer, setDraftBoardComposer] = useState("");
  const [historyTopics, setHistoryTopics] =
    useState<PublishedTopic[]>(seedPublishedTopics);
  const [selectedHistoryId, setSelectedHistoryId] = useState(
    seedPublishedTopics[0]?.id ?? "",
  );
  const [historyBoardComposer, setHistoryBoardComposer] = useState("");
  const [composeFeedback, setComposeFeedback] = useState<{
    message: string;
    tone: FeedbackTone;
  }>({
    message:
      "Use the middle studio to frame the topic, add opening board notes, and decide what reward should unlock after the topic ends.",
    tone: "neutral",
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const deferredDraft = useDeferredValue(draft);

  useEffect(() => {
    if (!isIntroOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      introRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isIntroOpen]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      historyRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isHistoryOpen]);

  useEffect(() => {
    let nextDraft = {
      ...defaultDraft,
      endAt: buildLocalDateTimeValue(72),
    };

    try {
      const savedDraft = window.localStorage.getItem(LOCAL_STORAGE_KEY);

      if (savedDraft) {
        nextDraft = sanitizeDraft(JSON.parse(savedDraft));
        setSaveStatus("saved");
      }
    } catch {
      setSaveStatus("idle");
    }

    setDraft(nextDraft);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setSaveStatus("saving");

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draft));
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    }, 320);

    return () => window.clearTimeout(timer);
  }, [draft, isHydrated]);

  useEffect(() => {
    setHistoryBoardComposer("");
  }, [selectedHistoryId]);

  const missingFields = getMissingFields(draft);
  const readyToPublish = missingFields.length === 0;
  const selectedHistoryTopic =
    historyTopics.find((topic) => topic.id === selectedHistoryId) ??
    historyTopics[0] ??
    null;
  const activeCategory =
    categoryOptions.find((option) => option.id === deferredDraft.category) ??
    categoryOptions[0]!;
  const activeReward =
    rewardOptions.find((option) => option.id === deferredDraft.rewardType) ??
    null;
  const endedTopicCount = historyTopics.filter(
    (topic) => topic.status === "ended",
  ).length;

  function updateDraft<K extends keyof DraftState>(
    key: K,
    value: DraftState[K],
  ) {
    startTransition(() => {
      setDraft((current) => ({
        ...current,
        [key]: value,
      }));
    });
  }

  function handleToggleIntro() {
    startTransition(() => {
      setIsIntroOpen((open) => !open);
    });
  }

  function handleToggleHistory() {
    startTransition(() => {
      setIsHistoryOpen((open) => !open);
    });
  }

  function handleToggleOpenGov() {
    startTransition(() => {
      setDraft((current) => ({
        ...current,
        category:
          current.isOpenGov && current.category === "OpenGov"
            ? "Community"
            : current.isOpenGov
              ? current.category
              : "OpenGov",
        isOpenGov: !current.isOpenGov,
      }));
    });
  }

  function handlePresetHours(hours: number) {
    updateDraft("endAt", buildLocalDateTimeValue(hours));
  }

  function handleAddDraftBoardEntry() {
    const nextCopy = draftBoardComposer.trim();

    if (!nextCopy) {
      setComposeFeedback({
        message: "Write the opening board note before adding it to the topic.",
        tone: "warning",
      });
      return;
    }

    const nextEntry = createBoardEntry(nextCopy, "Host");

    startTransition(() => {
      setDraft((current) => ({
        ...current,
        boardEntries: [nextEntry, ...current.boardEntries],
      }));
    });
    setDraftBoardComposer("");
    setComposeFeedback({
      message:
        "Opening board note added. Keep stacking the notes that should be visible as soon as the topic opens.",
      tone: "success",
    });
  }

  function handleRemoveDraftBoardEntry(entryId: string) {
    startTransition(() => {
      setDraft((current) => ({
        ...current,
        boardEntries: current.boardEntries.filter(
          (entry) => entry.id !== entryId,
        ),
      }));
    });
  }

  function handlePublishTopic() {
    if (!readyToPublish) {
      setComposeFeedback({
        message: `Complete ${missingFields.join(", ")} before publishing this topic packet.`,
        tone: "warning",
      });
      return;
    }

    const rewardType = draft.rewardType as RewardType;

    const nextTopic: PublishedTopic = {
      boardEntries: draft.boardEntries,
      category: draft.category,
      endAt: draft.endAt,
      id: createLocalId("topic"),
      isOpenGov: draft.isOpenGov,
      referendumId: draft.referendumId.trim(),
      rewardIssued: false,
      rewardIssuedLabel: null,
      rewardType,
      status: new Date(draft.endAt).getTime() <= Date.now() ? "ended" : "live",
      summary: draft.summary.trim(),
      title: draft.title.trim(),
      track: draft.track.trim(),
    };

    setHistoryTopics((current) => [nextTopic, ...current]);
    setSelectedHistoryId(nextTopic.id);
    setIsHistoryOpen(true);
    setDraft({
      ...defaultDraft,
      endAt: buildLocalDateTimeValue(72),
    });
    setDraftBoardComposer("");
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    setComposeFeedback({
      message:
        "Topic packet published into the history rail. Use the lower section to inspect it, and if it later ends, issue the selected reward or add more board notes there.",
      tone: "success",
    });
    setSaveStatus("idle");
    setLastSavedAt(null);
  }

  function handleResetDraft() {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    setDraft({
      ...defaultDraft,
      endAt: buildLocalDateTimeValue(72),
    });
    setDraftBoardComposer("");
    setComposeFeedback({
      message:
        "Draft reset. The studio is ready for a new topic frame and a fresh message board.",
      tone: "neutral",
    });
    setSaveStatus("idle");
    setLastSavedAt(null);
  }

  function handleIssueReward() {
    if (selectedHistoryTopic?.status !== "ended") {
      return;
    }

    setHistoryTopics((current) =>
      current.map((topic) =>
        topic.id === selectedHistoryTopic.id
          ? {
              ...topic,
              rewardIssued: true,
              rewardIssuedLabel: formatStamp(new Date()),
            }
          : topic,
      ),
    );
  }

  function handleAppendHistoryBoardEntry() {
    if (selectedHistoryTopic?.status !== "ended") {
      return;
    }

    const nextCopy = historyBoardComposer.trim();

    if (!nextCopy) {
      return;
    }

    const nextEntry = createBoardEntry(nextCopy, "Host");

    setHistoryTopics((current) =>
      current.map((topic) =>
        topic.id === selectedHistoryTopic.id
          ? {
              ...topic,
              boardEntries: [nextEntry, ...topic.boardEntries],
            }
          : topic,
      ),
    );
    setHistoryBoardComposer("");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-none flex-col px-0 pb-14">
      <section className="px-1 pt-1 sm:px-2">
        <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
          New Topic
        </p>

        <button
          type="button"
          onClick={handleToggleIntro}
          aria-controls={introId}
          aria-expanded={isIntroOpen}
          className="border-black/8 hover:border-black/12 mt-5 flex w-full flex-col gap-4 rounded-[1.8rem] border bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(244,239,231,0.78))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(15,17,17,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,17,17,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] sm:px-5 sm:py-5"
          style={{
            animation:
              "landing-fade-up 760ms cubic-bezier(0.18, 0.88, 0.22, 1) both",
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                {isIntroOpen ? "Introduction open" : "Introduction folded"}
              </p>
              <p className="mt-2 max-w-3xl text-[1rem] leading-7 text-neutral-600 sm:text-[1.04rem]">
                {isIntroOpen
                  ? "Tap anywhere on this introduction panel to fold the topic studio overview back into its compact state."
                  : "Tap anywhere on this introduction panel to unfold the full topic studio overview, including topic framing, reward setup, and the close-out history flow."}
              </p>
            </div>

            <div className="border-black/8 bg-white/72 flex items-center gap-2 self-start rounded-full border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  isIntroOpen ? "bg-emerald-400" : "bg-neutral-300"
                }`}
              />
              {isIntroOpen ? "Expanded" : "Collapsed"}
            </div>
          </div>
        </button>
      </section>

      <section
        ref={introRef}
        id={introId}
        aria-hidden={!isIntroOpen}
        className="scroll-mt-6 px-0 pt-6 sm:scroll-mt-8 sm:pt-8"
      >
        <div
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isIntroOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div
            className={`overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isIntroOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-4 opacity-0"
            }`}
          >
            <div className="grid gap-6 px-1 sm:px-2 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <section className="border-black/8 rounded-[1.9rem] border bg-[linear-gradient(150deg,rgba(255,255,255,0.92),rgba(247,243,236,0.76))] px-5 py-5 shadow-[0_22px_52px_rgba(15,17,17,0.06),inset_0_1px_0_rgba(255,255,255,0.84)] sm:px-6">
                <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
                  Topic Studio
                </p>
                <h1 className="mt-4 max-w-[12ch] text-[clamp(3rem,6.2vw,5.5rem)] font-normal leading-[0.9] tracking-[-0.08em] text-neutral-950">
                  Shape the topic, stage the{" "}
                  <UnderlineMark tone="sky">board</UnderlineMark>, and decide
                  the closing <TintMark tone="amber">reward</TintMark>.
                </h1>
                <p className="mt-5 max-w-[54rem] text-[1rem] leading-7 text-neutral-600 sm:text-[1.05rem]">
                  The middle studio behaves more like a control room than a
                  plain form. Topic type and parameters follow the same logic as
                  the square, but you can also seed the message board and choose
                  what unlocks after the topic ends.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <IntroNote
                    title="1. Frame"
                    copy="Pick the category, decide if it is OpenGov-linked, and carry the square parameters into the packet."
                  />
                  <IntroNote
                    title="2. Seed"
                    copy="Write the opening board notes that should already exist when the topic goes live."
                  />
                  <IntroNote
                    title="3. Close"
                    copy="After the topic ends, the history rail is where rewards are issued and additional board notes can be posted."
                  />
                </div>
              </section>

              <section className="rounded-[1.85rem] border border-sky-200/80 bg-[linear-gradient(150deg,rgba(239,246,255,0.9),rgba(255,255,255,0.76))] p-5 shadow-[0_20px_48px_rgba(59,130,246,0.08),inset_0_1px_0_rgba(255,255,255,0.84)]">
                <p className="text-sky-900/72 text-[0.68rem] font-medium uppercase tracking-[0.24em]">
                  Product Notes
                </p>
                <div className="mt-4 space-y-3 text-[0.96rem] leading-6 text-slate-700">
                  <p>
                    Topic fields stay aligned with square settings:{" "}
                    <span className="font-semibold">category</span>,{" "}
                    <span className="font-semibold">OpenGov mode</span>,{" "}
                    <span className="font-semibold">referendum ID</span>, and{" "}
                    <span className="font-semibold">track</span>.
                  </p>
                  <p>
                    Reward actions are currently a UI-only extension. The PRD
                    does not wire reward settlement yet, so this page should
                    only stage that experience.
                  </p>
                  <p className="bg-white/72 rounded-[1.2rem] border border-sky-200/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
                    The lower history section is where ended topics can issue a
                    reward and continue receiving board notes.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="px-1 pt-5 sm:px-2">
        <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
          Topic Studio
        </p>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="border-black/8 relative overflow-hidden rounded-[1.95rem] border bg-[linear-gradient(150deg,rgba(255,255,255,0.92),rgba(247,243,236,0.76))] p-5 shadow-[0_22px_54px_rgba(15,17,17,0.06),inset_0_1px_0_rgba(255,255,255,0.84)] sm:p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-[-3.5rem] top-[-5rem] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.22),rgba(125,211,252,0))]"
              />
              <div className="relative z-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
                      Topic packet
                    </p>
                    <p className="mt-2 max-w-2xl text-[0.98rem] leading-6 text-neutral-600">
                      Lead with the room title and the summary that should
                      travel into the square card.
                    </p>
                  </div>

                  <StatusChip
                    tone={saveStatus === "saved" ? "success" : "neutral"}
                  >
                    {formatSaveStatus(saveStatus, lastSavedAt, isHydrated)}
                  </StatusChip>
                </div>

                <label className="mt-6 block">
                  <span className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                    Topic title
                  </span>
                  <textarea
                    value={draft.title}
                    onChange={(event) => {
                      updateDraft("title", event.target.value);
                    }}
                    rows={2}
                    placeholder="Treasury reporting room for delivery slippage"
                    className="mt-4 min-h-[8.25rem] w-full resize-none border-0 bg-transparent p-0 text-[clamp(2.5rem,5vw,4.6rem)] font-normal leading-[0.9] tracking-[-0.075em] text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                    Topic summary
                  </span>
                  <textarea
                    value={draft.summary}
                    onChange={(event) => {
                      updateDraft("summary", event.target.value);
                    }}
                    rows={5}
                    placeholder="State the decision pressure, the missing evidence, and the exact conversation frame the room should enforce."
                    className="border-black/8 mt-3 min-h-[10rem] w-full resize-y rounded-[1.55rem] border bg-[rgba(247,243,236,0.62)] px-4 py-4 text-[1rem] leading-7 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] placeholder:text-neutral-400 focus:border-sky-300/80 focus:outline-none"
                  />
                </label>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
              <section className="border-black/8 rounded-[1.85rem] border bg-[rgba(255,255,255,0.8)] p-5 shadow-[0_20px_48px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.82)] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="border-black/8 flex size-11 items-center justify-center rounded-[1.2rem] border bg-[rgba(247,243,236,0.84)] text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    <Layers3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
                      Topic settings
                    </p>
                    <p className="mt-1 text-[0.96rem] leading-6 text-neutral-600">
                      Follow the same square vocabulary when defining the topic
                      type and optional parameters.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {categoryOptions.map((option) => {
                    const isActive = option.id === draft.category;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          updateDraft("category", option.id);
                        }}
                        className={`rounded-full border px-4 py-2 text-[0.8rem] font-semibold tracking-[0.02em] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] ${
                          isActive
                            ? option.tone
                            : "border-black/8 bg-[rgba(247,243,236,0.74)] text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                        }`}
                      >
                        {option.id}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-[0.95rem] leading-6 text-neutral-600">
                  {activeCategory.copy}
                </p>

                <div className="mt-6 rounded-[1.55rem] border border-sky-200/80 bg-[linear-gradient(155deg,rgba(239,246,255,0.82),rgba(255,255,255,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sky-900/72 text-[0.68rem] font-medium uppercase tracking-[0.22em]">
                        OpenGov mode
                      </p>
                      <p className="mt-2 text-[0.95rem] leading-6 text-slate-700">
                        Use the same optional parameters the square already
                        shows: referendum ID and track.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleOpenGov}
                      aria-pressed={draft.isOpenGov}
                      className={`relative inline-flex h-11 w-[4.9rem] shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] ${
                        draft.isOpenGov
                          ? "border-sky-400/70 bg-sky-500/90"
                          : "border-black/8 bg-white/80"
                      }`}
                    >
                      <span
                        className={`absolute top-1 flex size-9 items-center justify-center rounded-full bg-white text-neutral-950 shadow-[0_12px_24px_rgba(15,17,17,0.16)] transition-transform duration-200 ${
                          draft.isOpenGov
                            ? "translate-x-[2rem]"
                            : "translate-x-1"
                        }`}
                      >
                        <ShieldCheck className="size-4" />
                      </span>
                    </button>
                  </div>

                  <div
                    className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin-top] duration-300 ${
                      draft.isOpenGov
                        ? "mt-4 grid-rows-[1fr] opacity-100"
                        : "mt-0 grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                            Referendum ID
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draft.referendumId}
                            onChange={(event) => {
                              updateDraft("referendumId", event.target.value);
                            }}
                            placeholder="e.g. 1456"
                            className="border-black/8 mt-3 min-h-12 w-full rounded-[1.2rem] border bg-[rgba(247,243,236,0.72)] px-4 text-[0.95rem] text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] placeholder:text-neutral-400 focus:border-sky-300/80 focus:outline-none"
                          />
                        </label>

                        <label className="block">
                          <span className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                            Track
                          </span>
                          <input
                            type="text"
                            value={draft.track}
                            onChange={(event) => {
                              updateDraft("track", event.target.value);
                            }}
                            placeholder="e.g. Treasurer"
                            className="border-black/8 mt-3 min-h-12 w-full rounded-[1.2rem] border bg-[rgba(247,243,236,0.72)] px-4 text-[0.95rem] text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] placeholder:text-neutral-400 focus:border-sky-300/80 focus:outline-none"
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {openGovTrackSuggestions.map((track) => (
                          <button
                            key={track}
                            type="button"
                            onClick={() => {
                              updateDraft("track", track);
                            }}
                            className="rounded-full border border-sky-200/80 bg-[rgba(239,246,255,0.82)] px-3 py-2 text-[0.78rem] font-semibold text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)]"
                          >
                            {track}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-black/8 rounded-[1.85rem] border bg-[rgba(255,255,255,0.8)] p-5 shadow-[0_20px_48px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.82)] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="border-black/8 flex size-11 items-center justify-center rounded-[1.2rem] border bg-[rgba(247,243,236,0.84)] text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    <Gift className="size-5" />
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
                      Closing config
                    </p>
                    <p className="mt-1 text-[0.96rem] leading-6 text-neutral-600">
                      Set the topic expiration and the reward behavior that
                      becomes available once the topic has ended.
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                    Expiration
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { hours: 24, label: "24h" },
                      { hours: 72, label: "72h" },
                      { hours: 168, label: "7d" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          handlePresetHours(preset.hours);
                        }}
                        className="border-black/8 rounded-full border bg-[rgba(247,243,236,0.74)] px-4 py-2 text-[0.8rem] font-semibold tracking-[0.02em] text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)]"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 block">
                    <span className="sr-only">Topic expiration</span>
                    <input
                      type="datetime-local"
                      value={draft.endAt}
                      onChange={(event) => {
                        updateDraft("endAt", event.target.value);
                      }}
                      className="border-black/8 min-h-12 w-full rounded-[1.35rem] border bg-[rgba(247,243,236,0.7)] px-4 text-[0.95rem] text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] focus:border-sky-300/80 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="mt-6">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                    Reward type
                  </p>
                  <div className="mt-3 grid gap-3">
                    {rewardOptions.map((option) => {
                      const isActive = option.id === draft.rewardType;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            updateDraft("rewardType", option.id);
                          }}
                          className={`rounded-[1.35rem] border px-4 py-4 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] ${
                            isActive
                              ? option.tone
                              : "border-black/8 bg-[rgba(247,243,236,0.74)] text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[0.95rem] font-semibold tracking-[-0.02em]">
                              {option.label}
                            </span>
                            <ChevronRight className="size-4" />
                          </div>
                          <p className="mt-1.5 text-[0.9rem] leading-6">
                            {option.copy}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>

            <section className="border-black/8 rounded-[1.9rem] border bg-[rgba(255,255,255,0.8)] p-5 shadow-[0_22px_54px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.84)] sm:p-6">
              <div className="flex items-center gap-3">
                <div className="border-black/8 flex size-11 items-center justify-center rounded-[1.2rem] border bg-[rgba(247,243,236,0.84)] text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
                    Opening board
                  </p>
                  <p className="mt-1 text-[0.96rem] leading-6 text-neutral-600">
                    Seed the topic with the message-board content that should
                    exist from the first moment the topic is visible.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="min-w-0">
                  <label className="block">
                    <span className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                      Write a board note
                    </span>
                    <textarea
                      value={draftBoardComposer}
                      onChange={(event) => {
                        setDraftBoardComposer(event.target.value);
                      }}
                      rows={5}
                      placeholder="Explain the first signal, risk, or decision detail that should already be waiting inside the topic."
                      className="border-black/8 mt-3 min-h-[11rem] w-full resize-y rounded-[1.5rem] border bg-[rgba(247,243,236,0.68)] px-4 py-4 text-[1rem] leading-7 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] placeholder:text-neutral-400 focus:border-sky-300/80 focus:outline-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleAddDraftBoardEntry}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-950 bg-neutral-950 px-4 text-[0.92rem] font-semibold text-white shadow-[0_16px_32px_rgba(15,17,17,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)]"
                  >
                    Add board note
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="min-w-0">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                    Notes staged
                  </p>
                  <div className="mt-3 space-y-3">
                    {draft.boardEntries.length ? (
                      draft.boardEntries.map((entry) => (
                        <article
                          key={entry.id}
                          className="border-black/8 rounded-[1.35rem] border bg-[rgba(251,251,249,0.86)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                                {entry.author} · {entry.timeLabel}
                              </p>
                              <p className="mt-2 text-[0.95rem] leading-6 text-neutral-700">
                                {entry.copy}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleRemoveDraftBoardEntry(entry.id);
                              }}
                              className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-neutral-500 transition-colors duration-200 hover:text-neutral-950 focus-visible:outline-none"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="border-black/12 rounded-[1.35rem] border border-dashed bg-[rgba(247,243,236,0.56)] px-4 py-5 text-[0.95rem] leading-6 text-neutral-500">
                        No opening notes yet. Add the first message-board
                        content from the composer on the left.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6">
            <section className="overflow-hidden rounded-[2rem] border border-neutral-950 bg-neutral-950 text-white shadow-[0_34px_72px_rgba(15,17,17,0.22)]">
              <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-white/55">
                      Preview rail
                    </p>
                    <p className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-white">
                      Publish topic
                    </p>
                  </div>
                  <span className="border-white/12 bg-white/8 text-white/72 rounded-full border px-3 py-1.5 text-[0.73rem] font-semibold uppercase tracking-[0.18em]">
                    studio
                  </span>
                </div>

                <p className="text-white/72 mt-4 text-[0.96rem] leading-6">
                  This rail keeps the packet visible while you edit. It should
                  read like a compact version of the square card plus the close
                  action you are staging.
                </p>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  <StudioChip>{deferredDraft.category}</StudioChip>
                  <StudioChip>
                    {deferredDraft.isOpenGov ? "OpenGov" : "Standard"}
                  </StudioChip>
                  <StudioChip>
                    {activeReward ? activeReward.label : "Reward pending"}
                  </StudioChip>
                </div>

                <div>
                  <h2 className="max-w-[12ch] text-[2.1rem] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
                    {deferredDraft.title.trim() || "Untitled topic packet"}
                  </h2>
                  <p className="text-white/74 mt-3 text-[0.96rem] leading-6">
                    {deferredDraft.summary.trim() ||
                      "Your square-facing summary will appear here while you build the topic packet."}
                  </p>
                </div>

                <div className="grid gap-3">
                  <PreviewMetric
                    icon={<CalendarDays className="size-4" />}
                    label="Expiration"
                    value={formatDateTimeLabel(deferredDraft.endAt)}
                  />
                  <PreviewMetric
                    icon={<Gift className="size-4" />}
                    label="Reward"
                    value={
                      activeReward ? activeReward.label : "Choose reward type"
                    }
                  />
                  <PreviewMetric
                    icon={<MessageSquare className="size-4" />}
                    label="Board notes"
                    value={`${deferredDraft.boardEntries.length}`}
                  />
                  <PreviewMetric
                    icon={<CheckCheck className="size-4" />}
                    label="Packet"
                    value={
                      readyToPublish
                        ? "Ready to publish"
                        : `${missingFields.length} field${missingFields.length === 1 ? "" : "s"} missing`
                    }
                  />
                </div>

                {deferredDraft.isOpenGov ? (
                  <div className="bg-white/6 text-white/78 rounded-[1.4rem] border border-white/10 px-4 py-4 text-[0.92rem] leading-6">
                    <p className="text-white/54 text-[0.72rem] font-semibold uppercase tracking-[0.18em]">
                      OpenGov parameters
                    </p>
                    <p className="mt-2">
                      {deferredDraft.referendumId.trim()
                        ? deferredDraft.referendumId.trim()
                        : "No referendum ID yet"}
                      {" · "}
                      {deferredDraft.track.trim()
                        ? deferredDraft.track.trim()
                        : "No track yet"}
                    </p>
                  </div>
                ) : null}

                <div
                  className={`rounded-[1.45rem] border px-4 py-4 text-[0.95rem] leading-6 ${
                    composeFeedback.tone === "success"
                      ? "border-emerald-300/28 bg-emerald-400/10 text-emerald-50"
                      : composeFeedback.tone === "warning"
                        ? "border-amber-300/24 bg-amber-400/10 text-amber-50"
                        : "bg-white/6 text-white/78 border-white/10"
                  }`}
                >
                  {composeFeedback.message}
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handlePublishTopic}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[1.3rem] bg-white px-4 text-[0.96rem] font-semibold text-neutral-950 shadow-[0_16px_32px_rgba(255,255,255,0.12)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                  >
                    Publish topic
                    <ArrowRight className="size-4" />
                  </button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link
                      href="/app/square"
                      className="bg-white/6 text-white/88 flex min-h-11 items-center justify-center rounded-[1.2rem] border border-white/10 px-4 text-[0.9rem] font-semibold transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                    >
                      Open Square
                    </Link>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="text-white/72 hover:bg-white/6 flex min-h-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-transparent px-4 text-[0.9rem] font-semibold transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                    >
                      Reset draft
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section className="px-1 pt-6 sm:px-2">
        <p className="font-serif text-[1.02rem] font-medium italic tracking-[0.04em] text-slate-600/80">
          Published Topics
        </p>

        <button
          type="button"
          onClick={handleToggleHistory}
          aria-controls={historyId}
          aria-expanded={isHistoryOpen}
          className="border-black/8 hover:border-black/12 mt-5 flex w-full flex-col gap-4 rounded-[1.8rem] border bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(244,239,231,0.78))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(15,17,17,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,17,17,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] sm:px-5 sm:py-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                {isHistoryOpen ? "History open" : "History folded"}
              </p>
              <p className="mt-2 max-w-3xl text-[1rem] leading-7 text-neutral-600 sm:text-[1.04rem]">
                {isHistoryOpen
                  ? "Tap anywhere on this history panel to fold the published-topic rail back into its compact state."
                  : `Tap anywhere on this history panel to unfold ${historyTopics.length} published topics, including ${endedTopicCount} ended topic${endedTopicCount === 1 ? "" : "s"} ready for reward or extra board updates.`}
              </p>
            </div>

            <div className="border-black/8 bg-white/72 flex items-center gap-2 self-start rounded-full border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  isHistoryOpen ? "bg-emerald-400" : "bg-neutral-300"
                }`}
              />
              {isHistoryOpen ? "Expanded" : "Collapsed"}
            </div>
          </div>
        </button>
      </section>

      <section
        ref={historyRef}
        id={historyId}
        aria-hidden={!isHistoryOpen}
        className="scroll-mt-6 px-1 pt-6 sm:scroll-mt-8 sm:px-2"
      >
        <div
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isHistoryOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div
            className={`overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isHistoryOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-4 opacity-0"
            }`}
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-3">
                {historyTopics.map((topic) => (
                  <HistoryTopicCard
                    key={topic.id}
                    active={topic.id === selectedHistoryId}
                    onClick={() => {
                      setSelectedHistoryId(topic.id);
                    }}
                    topic={topic}
                  />
                ))}
              </div>

              {selectedHistoryTopic ? (
                <section className="border-black/8 rounded-[1.95rem] border bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_22px_54px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.84)] sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    <HistoryChip
                      tone={getStatusTone(selectedHistoryTopic.status)}
                    >
                      {selectedHistoryTopic.status === "ended"
                        ? "Ended"
                        : "Live"}
                    </HistoryChip>
                    <HistoryChip
                      tone={getCategoryTone(selectedHistoryTopic.category)}
                    >
                      {selectedHistoryTopic.category}
                    </HistoryChip>
                    <HistoryChip tone="neutral">
                      {getRewardLabel(selectedHistoryTopic.rewardType)}
                    </HistoryChip>
                  </div>

                  <h2 className="mt-5 max-w-[14ch] text-[clamp(2.2rem,4.5vw,3.5rem)] font-normal leading-[0.92] tracking-[-0.065em] text-neutral-950">
                    {selectedHistoryTopic.title}
                  </h2>
                  <p className="mt-4 max-w-[48rem] text-[1rem] leading-7 text-neutral-600">
                    {selectedHistoryTopic.summary}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <HistoryMetric
                      icon={<CalendarDays className="size-4" />}
                      label="Ended at"
                      value={formatDateTimeLabel(selectedHistoryTopic.endAt)}
                    />
                    <HistoryMetric
                      icon={<Trophy className="size-4" />}
                      label="Reward"
                      value={getRewardLabel(selectedHistoryTopic.rewardType)}
                    />
                    <HistoryMetric
                      icon={<MessageSquare className="size-4" />}
                      label="Board notes"
                      value={String(selectedHistoryTopic.boardEntries.length)}
                    />
                  </div>

                  {selectedHistoryTopic.isOpenGov ? (
                    <div className="mt-5 rounded-[1.45rem] border border-sky-200/80 bg-[rgba(239,246,255,0.82)] px-4 py-4 text-[0.95rem] leading-6 text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                      {selectedHistoryTopic.referendumId || "No referendum ID"}
                      {" · "}
                      {selectedHistoryTopic.track || "No track"}
                    </div>
                  ) : null}

                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <section className="border-black/8 rounded-[1.6rem] border bg-[rgba(247,243,236,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                      <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                        Ended topic actions
                      </p>
                      <p className="mt-2 text-[0.95rem] leading-6 text-neutral-600">
                        Ended topics can issue the configured reward and still
                        receive extra board updates after close.
                      </p>

                      <button
                        type="button"
                        onClick={handleIssueReward}
                        disabled={
                          selectedHistoryTopic.status !== "ended" ||
                          selectedHistoryTopic.rewardIssued
                        }
                        className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[1.2rem] px-4 text-[0.92rem] font-semibold transition-[transform,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] ${
                          selectedHistoryTopic.status !== "ended"
                            ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                            : selectedHistoryTopic.rewardIssued
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-neutral-950 text-white hover:-translate-y-0.5 hover:bg-neutral-800"
                        }`}
                      >
                        <Gift className="size-4" />
                        {selectedHistoryTopic.status !== "ended"
                          ? "Wait for topic end"
                          : selectedHistoryTopic.rewardIssued
                            ? `Reward issued ${selectedHistoryTopic.rewardIssuedLabel ?? ""}`
                            : "Issue reward now"}
                      </button>
                    </section>

                    <section className="border-black/8 rounded-[1.6rem] border bg-[rgba(247,243,236,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                      <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                        Post-close board note
                      </p>
                      <textarea
                        value={historyBoardComposer}
                        onChange={(event) => {
                          setHistoryBoardComposer(event.target.value);
                        }}
                        rows={4}
                        disabled={selectedHistoryTopic.status !== "ended"}
                        placeholder="Add the reward decision, archive note, or final moderator context here."
                        className="border-black/8 bg-white/78 mt-3 min-h-[9rem] w-full resize-y rounded-[1.35rem] border px-4 py-4 text-[0.95rem] leading-7 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] placeholder:text-neutral-400 focus:border-sky-300/80 focus:outline-none disabled:cursor-not-allowed disabled:bg-white/50 disabled:text-neutral-400"
                      />
                      <button
                        type="button"
                        onClick={handleAppendHistoryBoardEntry}
                        disabled={selectedHistoryTopic.status !== "ended"}
                        className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.9rem] font-semibold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] ${
                          selectedHistoryTopic.status !== "ended"
                            ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                            : "bg-neutral-950 text-white hover:-translate-y-0.5 hover:bg-neutral-800"
                        }`}
                      >
                        Add board note
                        <ChevronRight className="size-4" />
                      </button>
                    </section>
                  </div>

                  <div className="mt-6">
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                      Board history
                    </p>
                    <div className="mt-3 space-y-3">
                      {selectedHistoryTopic.boardEntries.map((entry) => (
                        <article
                          key={entry.id}
                          className="border-black/8 rounded-[1.35rem] border bg-[rgba(251,251,249,0.86)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]"
                        >
                          <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                            {entry.author} · {entry.timeLabel}
                          </p>
                          <p className="mt-2 text-[0.95rem] leading-6 text-neutral-700">
                            {entry.copy}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "amber" | "emerald" | "neutral" | "sky" | "violet";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-[rgba(214,246,230,0.9)] text-emerald-950"
      : tone === "sky"
        ? "bg-[rgba(220,233,247,0.92)] text-sky-950"
        : tone === "violet"
          ? "bg-[rgba(237,233,254,0.92)] text-violet-950"
          : tone === "amber"
            ? "bg-[rgba(250,232,179,0.88)] text-amber-950"
            : "bg-white/72 text-neutral-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function HistoryMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-black/8 rounded-[1.35rem] border bg-[rgba(247,243,236,0.74)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-neutral-700">{icon}</span>
        <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
          {label}
        </span>
      </div>
      <p className="mt-3 text-[1rem] font-semibold tracking-[-0.02em] text-neutral-950">
        {value}
      </p>
    </div>
  );
}

function HistoryTopicCard({
  active,
  onClick,
  topic,
}: {
  active: boolean;
  onClick: () => void;
  topic: PublishedTopic;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1.7rem] border p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] ${
        active
          ? "border-neutral-950/14 bg-[rgba(255,255,255,0.9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.84),0_0_0_1px_rgba(15,17,17,0.08)]"
          : "border-black/8 bg-[rgba(255,255,255,0.76)]"
      }`}
    >
      <div className="flex flex-wrap gap-2">
        <HistoryChip tone={getStatusTone(topic.status)}>
          {topic.status === "ended" ? "Ended" : "Live"}
        </HistoryChip>
        <HistoryChip tone={getCategoryTone(topic.category)}>
          {topic.category}
        </HistoryChip>
      </div>

      <h3 className="mt-4 max-w-[13ch] text-[1.6rem] font-semibold leading-[0.96] tracking-[-0.06em] text-neutral-950">
        {topic.title}
      </h3>
      <p className="mt-3 text-[0.95rem] leading-6 text-neutral-600">
        {topic.summary}
      </p>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="text-[0.74rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
          {formatDateTimeLabel(topic.endAt)}
        </div>
        <div className="rounded-full bg-[rgba(247,243,236,0.84)] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          {topic.rewardIssued
            ? "Reward sent"
            : getRewardLabel(topic.rewardType)}
        </div>
      </div>
    </button>
  );
}

function IntroNote({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="border-black/8 rounded-[1.45rem] border bg-[rgba(251,251,249,0.82)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </p>
      <p className="mt-2 text-[0.95rem] leading-6 text-neutral-600">{copy}</p>
    </div>
  );
}

function PreviewMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/6 rounded-[1.35rem] border border-white/10 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-white/62">{icon}</span>
        <span className="text-white/48 text-[0.68rem] font-medium uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <p className="mt-3 text-[1rem] font-semibold tracking-[-0.02em] text-white">
        {value}
      </p>
    </div>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "success";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${
        tone === "success"
          ? "border-emerald-300/80 bg-[rgba(209,250,229,0.78)] text-emerald-950"
          : "border-black/8 bg-[rgba(247,243,236,0.78)] text-neutral-600"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${
          tone === "success" ? "bg-emerald-500" : "bg-neutral-400"
        }`}
      />
      {children}
    </span>
  );
}

function StudioChip({ children }: { children: ReactNode }) {
  return (
    <span className="bg-white/8 text-white/74 rounded-full border border-white/10 px-3 py-1.5 text-[0.72rem] font-medium uppercase tracking-[0.18em]">
      {children}
    </span>
  );
}

function buildLocalDateTimeValue(hoursFromNow: number) {
  const nextDate = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const year = nextDate.getFullYear();
  const month = `${nextDate.getMonth() + 1}`.padStart(2, "0");
  const date = `${nextDate.getDate()}`.padStart(2, "0");
  const hours = `${nextDate.getHours()}`.padStart(2, "0");
  const minutes = `${nextDate.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${date}T${hours}:${minutes}`;
}

function createBoardEntry(copy: string, author: string): BoardEntry {
  return {
    author,
    copy,
    id: createLocalId("board"),
    timeLabel: formatStamp(new Date()),
  };
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDateTimeLabel(value: string) {
  if (!isValidDateTimeLocal(value)) {
    return "Choose expiration";
  }

  const [date, time] = value.split("T");
  return `${date} · ${time}`;
}

function formatSaveStatus(
  status: SaveStatus,
  lastSavedAt: number | null,
  isHydrated: boolean,
) {
  if (!isHydrated) {
    return "Loading draft";
  }

  if (status === "saving") {
    return "Saving locally";
  }

  if (status === "saved" && lastSavedAt) {
    return `Saved ${formatStamp(new Date(lastSavedAt))}`;
  }

  return "Local draft";
}

function formatStamp(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${month}/${day} ${hours}:${minutes}`;
}

function getCategoryTone(category: TopicCategory) {
  if (category === "OpenGov") {
    return "sky" as const;
  }

  if (category === "Treasury") {
    return "amber" as const;
  }

  if (category === "Protocol") {
    return "violet" as const;
  }

  if (category === "Community") {
    return "amber" as const;
  }

  return "emerald" as const;
}

function getMissingFields(draft: DraftState) {
  const missingFields: string[] = [];

  if (!draft.title.trim()) {
    missingFields.push("title");
  }

  if (!draft.summary.trim()) {
    missingFields.push("summary");
  }

  if (!isValidDateTimeLocal(draft.endAt)) {
    missingFields.push("expiration");
  }

  if (!draft.rewardType) {
    missingFields.push("reward type");
  }

  return missingFields;
}

function getRewardLabel(rewardType: RewardType) {
  return (
    rewardOptions.find((option) => option.id === rewardType)?.label ?? "Reward"
  );
}

function getStatusTone(status: PublishedTopicStatus) {
  return status === "ended" ? ("amber" as const) : ("emerald" as const);
}

function isValidBoardEntry(value: unknown): value is BoardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Record<keyof BoardEntry, unknown>>;

  return (
    typeof candidate.author === "string" &&
    typeof candidate.copy === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.timeLabel === "string"
  );
}

function isValidDateTimeLocal(value: string) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function sanitizeDraft(value: unknown): DraftState {
  if (!value || typeof value !== "object") {
    return {
      ...defaultDraft,
      endAt: buildLocalDateTimeValue(72),
    };
  }

  const candidate = value as Partial<Record<keyof DraftState, unknown>>;
  const category = categoryOptions.some(
    (option) => option.id === candidate.category,
  )
    ? (candidate.category as TopicCategory)
    : defaultDraft.category;
  const rewardType = rewardOptions.some(
    (option) => option.id === candidate.rewardType,
  )
    ? (candidate.rewardType as RewardType)
    : "";
  const boardEntries = Array.isArray(candidate.boardEntries)
    ? candidate.boardEntries.filter(isValidBoardEntry)
    : [];

  return {
    boardEntries,
    category,
    endAt:
      typeof candidate.endAt === "string" &&
      isValidDateTimeLocal(candidate.endAt)
        ? candidate.endAt
        : buildLocalDateTimeValue(72),
    isOpenGov: Boolean(candidate.isOpenGov),
    referendumId:
      typeof candidate.referendumId === "string" ? candidate.referendumId : "",
    rewardType,
    summary: typeof candidate.summary === "string" ? candidate.summary : "",
    title: typeof candidate.title === "string" ? candidate.title : "",
    track: typeof candidate.track === "string" ? candidate.track : "",
  };
}
