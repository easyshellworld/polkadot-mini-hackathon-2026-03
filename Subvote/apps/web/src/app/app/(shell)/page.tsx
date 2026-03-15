import type { ReactNode } from "react";

import { TintMark, UnderlineMark } from "@/app/app/_components/text-marks";

type StepItem = {
  id: string;
  content: ReactNode;
};

type NoteItem = {
  copy: ReactNode;
  id: string;
  title: string;
};

type RichItem = {
  content: ReactNode;
  id: string;
};

const participantSteps: readonly StepItem[] = [
  {
    id: "connect",
    content: (
      <>
        Connect your wallet and{" "}
        <UnderlineMark tone="sage">sign in</UnderlineMark>.
      </>
    ),
  },
  {
    id: "check-vp",
    content: (
      <>
        Check the <TintMark tone="amber">VP</TintMark> available to you from
        staked <TintMark tone="sky">vDOT</TintMark>.
      </>
    ),
  },
  {
    id: "join-topic",
    content: (
      <>
        Open a live <UnderlineMark tone="rose">topic</UnderlineMark> and join it{" "}
        <UnderlineMark tone="sage">on-chain</UnderlineMark>.
      </>
    ),
  },
  {
    id: "send-messages",
    content: (
      <>
        Send <UnderlineMark tone="sage">messages</UnderlineMark> inside the room
        and spend <TintMark tone="amber">VP</TintMark> as you speak.
      </>
    ),
  },
  {
    id: "review-archive",
    content: (
      <>
        Return to the <UnderlineMark tone="sky">archive</UnderlineMark> when the
        discussion closes.
      </>
    ),
  },
];

const creatorSteps: readonly StepItem[] = [
  {
    id: "creator-connect",
    content: (
      <>
        Connect your wallet and confirm you have spare{" "}
        <TintMark tone="amber">VP</TintMark>.
      </>
    ),
  },
  {
    id: "draft-topic",
    content: (
      <>
        Draft the <UnderlineMark tone="rose">topic</UnderlineMark> you want to
        open.
      </>
    ),
  },
  {
    id: "publish-lock",
    content: (
      <>
        Publish it <UnderlineMark tone="sage">on-chain</UnderlineMark> and lock{" "}
        <TintMark tone="rose">50 VP</TintMark> while it stays active.
      </>
    ),
  },
  {
    id: "host-room",
    content: (
      <>
        Let members join, discuss, and spend{" "}
        <TintMark tone="amber">VP</TintMark> inside the room.
      </>
    ),
  },
  {
    id: "close-topic",
    content: (
      <>
        Close the <UnderlineMark tone="rose">topic</UnderlineMark> later to
        release the lock and <UnderlineMark tone="sky">archive</UnderlineMark>{" "}
        the record.
      </>
    ),
  },
];

const capabilityNotes: readonly NoteItem[] = [
  {
    id: "join",
    title: "Join",
    copy: (
      <>
        Enter a <UnderlineMark tone="sky">topic</UnderlineMark> and participate
        with <TintMark tone="amber">VP</TintMark>.
      </>
    ),
  },
  {
    id: "start",
    title: "Start",
    copy: (
      <>
        Open a <UnderlineMark tone="rose">topic</UnderlineMark> and host the
        discussion.
      </>
    ),
  },
  {
    id: "review",
    title: "Review",
    copy: (
      <>
        Read the <UnderlineMark tone="sky">archive</UnderlineMark> after the
        room closes.
      </>
    ),
  },
];

const loopSteps: readonly RichItem[] = [
  {
    id: "stake",
    content: (
      <>
        Stake <TintMark tone="sky">vDOT</TintMark>
      </>
    ),
  },
  {
    id: "receive",
    content: (
      <>
        Receive <TintMark tone="amber">VP</TintMark>
      </>
    ),
  },
  {
    id: "join-or-start",
    content: (
      <>
        Join or start a <UnderlineMark tone="rose">topic</UnderlineMark>
      </>
    ),
  },
  {
    id: "discuss",
    content: (
      <>
        Discuss with <TintMark tone="amber">VP</TintMark>
      </>
    ),
  },
  {
    id: "review",
    content: (
      <>
        Review the <UnderlineMark tone="sky">archive</UnderlineMark>
      </>
    ),
  },
];

const keyRules: readonly RichItem[] = [
  {
    id: "topic-lock",
    content: (
      <>
        Creating a{" "}
        <UnderlineMark tone="sky" inverse>
          topic
        </UnderlineMark>{" "}
        locks{" "}
        <TintMark tone="rose" inverse>
          50 VP
        </TintMark>{" "}
        until the room closes.
      </>
    ),
  },
  {
    id: "message-cost",
    content: (
      <>
        Each{" "}
        <UnderlineMark tone="sage" inverse>
          message
        </UnderlineMark>{" "}
        costs{" "}
        <TintMark tone="amber" inverse>
          VP
        </TintMark>{" "}
        based on topic type and message length.
      </>
    ),
  },
  {
    id: "archive-anchor",
    content: (
      <>
        Closed topics become replayable{" "}
        <UnderlineMark tone="sky" inverse>
          archives
        </UnderlineMark>{" "}
        with an{" "}
        <UnderlineMark tone="sage" inverse>
          on-chain hash anchor
        </UnderlineMark>
        .
      </>
    ),
  },
];

export default function AppHome() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-none flex-col px-0 py-6 sm:py-8">
      <div className="my-auto flex flex-col gap-5 sm:gap-6">
        <header className="grid items-start gap-5 border-b border-black/8 pb-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
          <div className="space-y-4">
            <p className="font-serif text-[1.05rem] font-medium tracking-[0.04em] text-slate-600/80 italic">
              How to use subvote
            </p>
            <h1 className="max-w-[13ch] text-[clamp(3.1rem,6.8vw,6rem)] leading-[0.92] font-normal tracking-[-0.075em] text-neutral-950">
              Join a <UnderlineMark tone="sage">discussion</UnderlineMark> or
              start one with <TintMark tone="amber">VP</TintMark>.
            </h1>
            <p className="max-w-[56rem] text-[1rem] leading-7 text-neutral-600 sm:text-[1.06rem]">
              Subvote turns staked <TintMark tone="sky">vDOT</TintMark> into
              usable discussion power. Use <TintMark tone="amber">VP</TintMark> to
              join an active <UnderlineMark tone="rose">topic</UnderlineMark>,
              send <UnderlineMark tone="sage">messages</UnderlineMark> inside it,
              or lock VP to open a topic of your own. When the topic ends, the{" "}
              <UnderlineMark tone="sky">archive</UnderlineMark> stays available to
              review.
            </p>
          </div>

          <aside className="rounded-[1.7rem] border border-black/8 bg-[rgba(255,255,255,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <p className="text-[0.68rem] font-medium tracking-[0.22em] text-neutral-500 uppercase">
              This app lets you
            </p>
            <div className="mt-4 grid gap-3">
              {capabilityNotes.map((item) => (
                <MiniNote key={item.id} title={item.title} copy={item.copy} />
              ))}
            </div>
          </aside>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <RoleCard
            eyebrow="For participants"
            title={
              <>
                Join a <UnderlineMark tone="sky">topic</UnderlineMark>
              </>
            }
            summary={
              <>
                This path is for members who want to enter an active discussion
                and spend <TintMark tone="amber">VP</TintMark> as they speak.
              </>
            }
            steps={participantSteps}
          />

          <RoleCard
            eyebrow="For topic creators"
            title={
              <>
                Start a <UnderlineMark tone="rose">topic</UnderlineMark>
              </>
            }
            summary={
              <>
                This path is for members who want to publish a topic, lock{" "}
                <TintMark tone="rose">50 VP</TintMark>, and close the room later.
              </>
            }
            steps={creatorSteps}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <article className="rounded-[1.8rem] border border-black/8 bg-[rgba(255,255,255,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5">
            <p className="text-[0.68rem] font-medium tracking-[0.22em] text-neutral-500 uppercase">
              The basic loop
            </p>
            <ol className="mt-4 grid gap-3 md:grid-cols-5">
              {loopSteps.map((step, index) => (
                <li
                  key={step.id}
                  className="rounded-[1.3rem] border border-black/8 bg-[rgba(247,243,236,0.82)] px-3 py-4"
                >
                  <p className="text-[0.72rem] font-medium tracking-[0.18em] text-neutral-500 uppercase">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 text-sm leading-6 font-medium text-neutral-900">
                    {step.content}
                  </p>
                </li>
              ))}
            </ol>
          </article>

          <article className="rounded-[1.8rem] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-[0_22px_50px_rgba(15,17,17,0.16)] sm:p-5">
            <p className="text-[0.68rem] font-medium tracking-[0.22em] text-white/50 uppercase">
              Key rules
            </p>
            <ul className="mt-4 grid gap-3">
              {keyRules.map((rule) => (
                <li
                  key={rule.id}
                  className="rounded-[1.2rem] border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-white/82"
                >
                  {rule.content}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </div>
    </div>
  );
}

function RoleCard({
  eyebrow,
  steps,
  summary,
  title,
}: {
  eyebrow: string;
  steps: readonly StepItem[];
  summary: ReactNode;
  title: ReactNode;
}) {
  return (
    <article className="rounded-[1.8rem] border border-black/8 bg-[rgba(255,255,255,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-neutral-500 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[1.65rem] leading-[1.02] font-semibold tracking-[-0.05em] text-neutral-950">
        {title}
      </h2>
      <p className="mt-3 max-w-[34rem] text-sm leading-6 text-neutral-600">
        {summary}
      </p>

      <ol className="mt-5 grid gap-2.5">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex gap-3 rounded-[1.2rem] border border-black/8 bg-[rgba(247,243,236,0.82)] px-3 py-3"
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-black/8 bg-white text-[0.75rem] font-semibold text-neutral-700">
              {index + 1}
            </span>
            <span className="text-sm leading-6 text-neutral-700">
              {step.content}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function MiniNote({ copy, title }: { copy: ReactNode; title: string }) {
  return (
    <div className="rounded-[1.2rem] border border-black/8 bg-[rgba(247,243,236,0.84)] px-3 py-3">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-neutral-500 uppercase">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-700">{copy}</p>
    </div>
  );
}
