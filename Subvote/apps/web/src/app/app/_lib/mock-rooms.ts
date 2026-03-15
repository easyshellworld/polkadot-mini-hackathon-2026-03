export type TopicCategory =
  | "OpenGov"
  | "Treasury"
  | "Protocol"
  | "Community"
  | "Operations";

export type TopicStatus = "live" | "closing" | "archived";

export type RoomActivityPreview = {
  author: string;
  excerpt: string;
  time: string;
};

export type RoomRichTextTone = "accent" | "default" | "muted" | "strong";

export type RoomRichTextSpan = {
  href?: string;
  text: string;
  tone?: RoomRichTextTone;
};

export type RoomRichTextBlock =
  | {
      content: readonly RoomRichTextSpan[];
      type: "heading" | "paragraph";
    }
  | {
      content: readonly RoomRichTextSpan[];
      label: string;
      type: "callout";
    }
  | {
      items: readonly (readonly RoomRichTextSpan[])[];
      type: "list";
    }
  | {
      content: readonly RoomRichTextSpan[];
      source?: readonly RoomRichTextSpan[];
      type: "quote";
    };

export type RoomHostBoard = {
  currentAsk: string;
  headline: string;
  latestShift: string;
  note: string;
  openRisks: readonly string[];
  updatedAtLabel: string;
};

export type SquareRoom = {
  activityPreview: readonly RoomActivityPreview[];
  category: TopicCategory;
  closesAtLabel: string;
  createdByUser: boolean;
  creatorName: string;
  creatorRole: string;
  hostBoard: RoomHostBoard;
  id: string;
  members: number;
  messages: number;
  openedAtLabel: string;
  participatedByUser: boolean;
  projectOverview: readonly RoomRichTextBlock[];
  referendumId?: string;
  status: TopicStatus;
  summary: string;
  title: string;
  topicHash: string;
  track?: string;
};

const plain = (text: string): RoomRichTextSpan => ({
  text,
  tone: "default",
});

const muted = (text: string): RoomRichTextSpan => ({
  text,
  tone: "muted",
});

const strong = (text: string): RoomRichTextSpan => ({
  text,
  tone: "strong",
});

const accent = (text: string): RoomRichTextSpan => ({
  text,
  tone: "accent",
});

const heading = (...content: RoomRichTextSpan[]): RoomRichTextBlock => ({
  content,
  type: "heading",
});

const paragraph = (...content: RoomRichTextSpan[]): RoomRichTextBlock => ({
  content,
  type: "paragraph",
});

const callout = (
  label: string,
  ...content: RoomRichTextSpan[]
): RoomRichTextBlock => ({
  content,
  label,
  type: "callout",
});

const list = (
  ...items: readonly RoomRichTextSpan[][]
): RoomRichTextBlock => ({
  items,
  type: "list",
});

const quote = (
  content: readonly RoomRichTextSpan[],
  source?: readonly RoomRichTextSpan[],
): RoomRichTextBlock => ({
  content,
  source,
  type: "quote",
});

const roomProjectOverviews = {
  "treasury-liquidity": [
    heading(strong("Current extension case")),
    paragraph(
      plain(
        "This room is testing whether treasury-backed liquidity incentives still create durable depth, or whether the program is now paying for noise that the market would deliver anyway.",
      ),
    ),
    callout(
      "Decision frame",
      accent("Extension is only credible "),
      plain("if the next quarter ships with explicit reporting, comparable historical baselines, and a written stop condition."),
    ),
    paragraph(
      strong("Decision pressure: "),
      plain(
        "delegates want one more quarter only if the reporting model becomes explicit before the renewal is approved.",
      ),
    ),
    list(
      [accent("Compare"), plain(" this cycle against the previous incentive window using the same liquidity pairs.")],
      [accent("Define"), plain(" the exact target metric: route depth, retention, or actual trading behavior.")],
      [accent("Require"), plain(" an operational reporting cadence that can trigger an early stop if results stay weak.")],
    ),
    quote(
      [
        plain(
          "If the program cannot explain where the depth came from, the treasury is funding a story rather than a market outcome.",
        ),
      ],
      [muted("Recurring critique from the latest closing discussion")],
    ),
  ],
  "opengov-clinic": [
    heading(strong("Proposal shaping brief")),
    paragraph(
      plain(
        "The clinic exists to tighten public-facing proposals before they leave draft mode, so the first read explains the public outcome instead of burying it under implementation detail.",
      ),
    ),
    callout(
      "Editing rule",
      strong("The first paragraph should carry the public-interest claim. "),
      plain("Implementation detail only works once reviewers already understand the social or network outcome being requested."),
    ),
    paragraph(
      strong("Current emphasis: "),
      plain(
        "improve framing, separate motivation from execution, and make the downside of a failed referendum explicit.",
      ),
    ),
    list(
      [accent("Lead"), plain(" with the public-interest claim in one sharp paragraph.")],
      [accent("Split"), plain(" the narrative into why this matters, what changes, and how delivery will happen.")],
      [accent("Clarify"), plain(" what happens if the referendum does not pass, so reviewers can compare tradeoffs.")],
    ),
  ],
  "runtime-office-hours": [
    heading(strong("Office-hours scope")),
    paragraph(
      plain("This room collects "),
      strong("runtime upgrade edge cases"),
      plain(
        " before they harden into repeated operational pain. The aim is not broad chatter, but a compact record of failures, tool gaps, and likely fixes.",
      ),
    ),
    callout(
      "Triage threshold",
      accent("A report should either reproduce cleanly "),
      plain("or explain exactly why it breaks operator confidence during an upgrade. Everything else stays as a loose note until narrowed."),
    ),
    paragraph(
      strong("What belongs here: "),
      plain(
        "metadata mismatches, tooling regressions, telemetry anomalies, and any runtime-side issue that operators can reproduce across environments.",
      ),
    ),
    list(
      [accent("Capture"), plain(" reproducible upgrade regressions before they fragment into separate issue threads.")],
      [accent("Prioritize"), plain(" cases that affect local dev chains, operator confidence, or upgrade verification.")],
      [accent("Leave"), plain(" with a short checklist that can be handed back to the fellowship or tooling maintainers.")],
    ),
    quote(
      [
        plain(
          "If two operators hit the same breakage from different setups, it stops being anecdotal and starts being release-critical.",
        ),
      ],
      [muted("Working heuristic used in this week's office hours")],
    ),
  ],
  "grants-rubric": [
    heading(strong("Rubric workshop")),
    paragraph(
      plain(
        "The workshop is refining how community grants are scored before the next funding cycle opens, with the goal of rewarding meaningful evidence instead of rewarding teams that simply produce more output volume.",
      ),
    ),
    callout(
      "Scoring intent",
      strong("Evidence quality should outrank update frequency. "),
      plain("The rubric is being tuned to reward demonstrated outcomes, not just the volume of reporting artifacts a team can produce."),
    ),
    paragraph(
      strong("Review lens: "),
      plain(
        "impact, criticality, and quality of evidence should read more clearly than generic productivity signals.",
      ),
    ),
    list(
      [accent("Raise"), plain(" the weight of demonstrable outcomes over update frequency.")],
      [accent("Differentiate"), plain(" exploratory work from maintenance work that protects critical operations.")],
      [accent("Show"), plain(" applicants what strong evidence looks like through concrete examples.")],
    ),
  ],
  "validator-onboarding": [
    heading(strong("Operator onboarding review")),
    paragraph(
      plain(
        "This room is documenting where first-time validator operators lose confidence: where the docs assume too much, where verification is unclear, and where a single missing example can stall the whole setup path.",
      ),
    ),
    callout(
      "Design goal",
      accent("A first-time operator should be able to finish the path without already thinking like an infra engineer. "),
      plain("That means less hidden context, fewer leaps, and more explicit confirmation steps."),
    ),
    paragraph(
      strong("Main objective: "),
      plain(
        "turn the onboarding path into something that first-time operators can complete without already thinking like infrastructure engineers.",
      ),
    ),
    list(
      [accent("Split"), plain(" setup from verification so each stage has a cleaner mental model.")],
      [accent("Add"), plain(" explicit examples for key rotation, checks, and post-change confirmation.")],
      [accent("Reduce"), plain(" hidden assumptions about baseline node operations knowledge.")],
    ),
  ],
  "delegation-writing": [
    heading(strong("Communication pass")),
    paragraph(
      plain(
        "This room is about rewriting delegation and governance updates so they land with less insider language. The audience is not just frequent governance readers, but delegates, followers, and contributors who need the practical meaning quickly.",
      ),
    ),
    callout(
      "Editorial rule",
      strong("Consequence first, context second, policy detail third. "),
      plain("If the real-world effect arrives too late, most readers will never recover the thread of why the update mattered."),
    ),
    paragraph(
      strong("Editorial target: "),
      plain(
        "put consequence first, then context, then policy detail, so readers understand why the update matters before the institutional background arrives.",
      ),
    ),
    list(
      [accent("Open"), plain(" with the real-world consequence, not the internal process.")],
      [accent("Translate"), plain(" delegation logic into plain language before referencing policy scaffolding.")],
      [accent("Layer"), plain(" enough context for infrequent OpenGov readers to stay oriented.")],
    ),
  ],
  "treasury-execution": [
    heading(strong("Execution diary")),
    paragraph(
      plain(
        "This room tracks what happened after treasury approvals: what actually moved, what got delayed, and where execution friction showed up between decision and delivery.",
      ),
    ),
    callout(
      "Operational value",
      accent("Treasury decisions are hard to evaluate in isolation. "),
      plain("The diary exists to connect approvals to execution reality, especially when dependencies or vendors introduce delay outside the proposal text."),
    ),
    paragraph(
      strong("Why it matters: "),
      plain(
        "treasury decision quality is hard to judge without a cleaner record of implementation blockers, dependencies, and what finally shipped.",
      ),
    ),
    list(
      [accent("Log"), plain(" execution state in a format that can be compared across very different proposals.")],
      [accent("Expose"), plain(" blockers early instead of hiding them behind final delivery updates.")],
      [accent("Preserve"), plain(" a later audit trail that connects approvals to practical outcomes.")],
    ),
    quote(
      [
        plain(
          "A proposal can look successful on-chain while still failing operationally if nobody can explain the delay between approval and delivery.",
        ),
      ],
      [muted("Reason this room was opened by the execution tracker")],
    ),
  ],
  "delegate-retrospective": [
    heading(strong("Archive retrospective")),
    paragraph(
      plain(
        "This archived room captures what delegates felt was missing from the last public reasoning round, especially where rationale quality improved but public summaries still lagged behind the actual discussion.",
      ),
    ),
    callout(
      "Archive use",
      strong("Treat this room as a reading archive, not a live workshop. "),
      plain("The value here is pattern recognition: where better reasoning emerged, and where public explanation still failed to catch up."),
    ),
    paragraph(
      strong("Use this archive to study: "),
      plain(
        "how reasoning converged, which public explanations landed, and where participants needed stronger links between implementation detail and public-interest outcomes.",
      ),
    ),
    list(
      [accent("Trace"), plain(" the moments when the conversation became more concrete and useful.")],
      [accent("Notice"), plain(" how narrower concerns produced faster convergence than broad sentiment.")],
      [accent("Reuse"), plain(" the better summary patterns in future public reasoning rounds.")],
    ),
  ],
} satisfies Record<string, readonly RoomRichTextBlock[]>;

const roomHostBoards = {
  "treasury-liquidity": {
    currentAsk:
      "Pressure-test whether one more quarter can be justified only with explicit reporting gates and a pre-written stop condition.",
    headline: "Do not renew on momentum alone.",
    latestShift:
      "More delegates are open to a short extension, but only if the reporting cadence becomes binding before approval.",
    note: "The discussion is no longer about whether liquidity matters. It is about whether treasury can still distinguish durable market depth from subsidized noise.",
    openRisks: [
      "Impact data is still inconsistent across pairs.",
      "The next quarter could inherit the same weak reporting model.",
      "Delegates may converge on extension language before the control metrics are pinned down.",
    ],
    updatedAtLabel: "Updated 18m ago",
  },
  "opengov-clinic": {
    currentAsk:
      "Rewrite the opening section until a first-time reviewer can understand the public outcome without reading the implementation detail first.",
    headline: "The first paragraph still carries too much machinery.",
    latestShift:
      "The room moved away from line edits and toward structure: motivation, consequence, and delivery are being separated more cleanly.",
    note: "I want this clinic to help proposals survive first contact with skeptical readers. If the framing is weak, the delivery plan never gets a fair read.",
    openRisks: [
      "Public-interest language is still buried too low in the draft.",
      "Tradeoffs of a failed referendum remain underexplained.",
      "Track context can still overwhelm readers who are not frequent OpenGov participants.",
    ],
    updatedAtLabel: "Updated 11m ago",
  },
  "runtime-office-hours": {
    currentAsk:
      "Keep reports narrowly reproducible and leave with a short triage path the fellowship or tooling maintainers can actually act on.",
    headline: "Treat repeated operator pain as release signal.",
    latestShift:
      "Two separate reports now point to the same tooling regression, which means the room is moving from anecdote collection into patch-priority territory.",
    note: "This is not a general protocol lounge. I am using the room to collect breakage that keeps recurring across upgrades until the pattern is too clear to dismiss.",
    openRisks: [
      "Similar failures are still being described with different vocabulary.",
      "Operators can reproduce the symptom but not always the exact trigger path.",
      "Tooling-side regressions may get mixed with runtime-side regressions if the reports stay too broad.",
    ],
    updatedAtLabel: "Updated 7m ago",
  },
  "grants-rubric": {
    currentAsk:
      "Stress-test the scoring rubric against real applicant profiles and see whether evidence quality actually outranks output volume.",
    headline: "Reward proof, not activity theater.",
    latestShift:
      "The conversation is starting to separate exploratory grants from maintenance grants instead of scoring both with the same evidence language.",
    note: "The point of this room is to make the rubric legible before the next cycle opens. If teams cannot tell what strong evidence looks like, the process stays performative.",
    openRisks: [
      "Criteria still flatten very different kinds of work into one score.",
      "Examples of strong evidence are not concrete enough yet.",
      "The language may still advantage teams that are simply better at reporting.",
    ],
    updatedAtLabel: "Updated 25m ago",
  },
  "validator-onboarding": {
    currentAsk:
      "Identify the exact checkpoints where first-time operators stop trusting the guide and rewrite those steps with explicit verification.",
    headline: "The docs assume confidence too early.",
    latestShift:
      "The room has narrowed from broad onboarding frustration to a handful of failure points around setup, key rotation, and post-change confirmation.",
    note: "I opened this room because most onboarding friction is not about missing commands. It is about the moment a new operator no longer knows whether the system is in a good state.",
    openRisks: [
      "The setup path and the verification path are still collapsed together.",
      "Examples are missing exactly where confidence drops.",
      "The current docs still presume more baseline ops knowledge than first-time validators have.",
    ],
    updatedAtLabel: "Updated 9m ago",
  },
  "delegation-writing": {
    currentAsk:
      "Push every update draft toward consequence-first writing, then backfill context only once the practical meaning is obvious.",
    headline: "Write for readers who do not live inside governance.",
    latestShift:
      "The room is converging on a clearer editorial order: real-world consequence first, then context, then policy and delegation detail.",
    note: "This board is here to keep the room honest. If a reader needs insider fluency before the stakes are clear, the writing has failed before the policy argument begins.",
    openRisks: [
      "Delegation logic is still explained in institutional terms before practical terms.",
      "Some drafts still read like minutes rather than public communication.",
      "Context blocks may grow too long and delay the core message again.",
    ],
    updatedAtLabel: "Updated 13m ago",
  },
  "treasury-execution": {
    currentAsk:
      "Keep the execution diary comparable across proposals so later readers can trace which approvals moved smoothly and which stalled in delivery.",
    headline: "Approval is not the same thing as execution.",
    latestShift:
      "Recent messages are forcing a clearer split between treasury-side delay, vendor-side delay, and external dependency delay.",
    note: "I want this room to document what happened after the vote. Treasury decisions only become auditable when the implementation path is recorded with enough honesty to show friction.",
    openRisks: [
      "State updates still vary too much in format to compare easily.",
      "Some blockers only surface after the final delivery update.",
      "People may over-attribute delays to treasury when the dependency chain is external.",
    ],
    updatedAtLabel: "Updated 21m ago",
  },
  "delegate-retrospective": {
    currentAsk:
      "Use the archive to trace where rationale quality improved and where public explanation still failed to keep up with the actual discussion.",
    headline: "Archive the reasoning, not just the vote.",
    latestShift:
      "Looking back, the strongest moments came when delegates named one concrete concern instead of broad sentiment and then tied it back to public outcomes.",
    note: "This room is no longer live, but it still matters. I want future rounds to inherit the better summary patterns without repeating the same vague public explanations.",
    openRisks: [
      "Readers may treat archive consensus as if it were still a live position.",
      "Key summary improvements are easy to miss unless the timeline is read carefully.",
      "The room still shows how quickly public reasoning drifts when no one restates the stakes plainly.",
    ],
    updatedAtLabel: "Updated 2d ago",
  },
} satisfies Record<string, RoomHostBoard>;

export const rooms: readonly SquareRoom[] = [
  {
    id: "treasury-liquidity",
    title: "Treasury track liquidity incentives",
    summary:
      "A high-traffic OpenGov room deciding whether treasury-backed liquidity incentives should be extended for one more quarter.",
    category: "OpenGov",
    status: "closing",
    createdByUser: false,
    participatedByUser: false,
    creatorName: "Treasury Signals Circle",
    creatorRole: "Room host",
    hostBoard: roomHostBoards["treasury-liquidity"],
    openedAtLabel: "Opened 11h ago",
    closesAtLabel: "Closes in 7h",
    topicHash: "0x9f2b…a118",
    members: 34,
    messages: 126,
    projectOverview: roomProjectOverviews["treasury-liquidity"],
    referendumId: "Ref #418",
    track: "Treasurer",
    activityPreview: [
      {
        author: "Mina",
        time: "8m ago",
        excerpt:
          "The current incentive window is still under-instrumented, so extension without better reporting feels weak.",
      },
      {
        author: "Riku",
        time: "22m ago",
        excerpt:
          "If treasury keeps the program live, the reporting cadence needs to be written into the operational plan first.",
      },
      {
        author: "June",
        time: "41m ago",
        excerpt:
          "Several delegates are aligned on one more quarter only if liquidity impact is compared against previous cycles.",
      },
    ],
  },
  {
    id: "opengov-clinic",
    title: "OpenGov proposer clinic",
    summary:
      "A governance room helping proposers refine framing before they move a draft into public review.",
    category: "OpenGov",
    status: "live",
    createdByUser: false,
    participatedByUser: true,
    creatorName: "Lina Park",
    creatorRole: "Proposal editor",
    hostBoard: roomHostBoards["opengov-clinic"],
    openedAtLabel: "Opened 6h ago",
    closesAtLabel: "Closes in 1d 8h",
    topicHash: "0x8c29…e4f1",
    members: 22,
    messages: 97,
    projectOverview: roomProjectOverviews["opengov-clinic"],
    referendumId: "Ref #412",
    track: "Root",
    activityPreview: [
      {
        author: "Lina",
        time: "6m ago",
        excerpt:
          "The proposer narrative still reads as implementation-first. We need one clearer public-interest paragraph at the top.",
      },
      {
        author: "You",
        time: "19m ago",
        excerpt:
          "I would separate the motivation from the delivery plan so reviewers can agree on the why before the how.",
      },
      {
        author: "Soren",
        time: "34m ago",
        excerpt:
          "Track context is good, but the request still needs one sentence on what changes if the referendum does not pass.",
      },
    ],
  },
  {
    id: "runtime-office-hours",
    title: "Runtime fellowship office hours",
    summary:
      "A protocol-facing room collecting edge cases from recent runtime upgrades and tooling around them.",
    category: "Protocol",
    status: "live",
    createdByUser: false,
    participatedByUser: false,
    creatorName: "Runtime Fellowship",
    creatorRole: "Protocol working group",
    hostBoard: roomHostBoards["runtime-office-hours"],
    openedAtLabel: "Opened 3h ago",
    closesAtLabel: "Closes in 2d 4h",
    topicHash: "0x64b3…c917",
    members: 16,
    messages: 57,
    projectOverview: roomProjectOverviews["runtime-office-hours"],
    activityPreview: [
      {
        author: "Ari",
        time: "12m ago",
        excerpt:
          "The latest upgrade fixed the weight issue, but the tooling still misreports one error path for local dev chains.",
      },
      {
        author: "Nika",
        time: "29m ago",
        excerpt:
          "We should collect all metadata version mismatches in one thread before the next patch set ships.",
      },
      {
        author: "Pavel",
        time: "54m ago",
        excerpt:
          "Two operators reported the same telemetry regression. That probably deserves a separate checklist item.",
      },
    ],
  },
  {
    id: "grants-rubric",
    title: "Community grants rubric workshop",
    summary:
      "A working room refining how community grants should be scored before the next funding cycle opens.",
    category: "Community",
    status: "live",
    createdByUser: false,
    participatedByUser: false,
    creatorName: "Community Funding Desk",
    creatorRole: "Program steward",
    hostBoard: roomHostBoards["grants-rubric"],
    openedAtLabel: "Opened 9h ago",
    closesAtLabel: "Closes in 2d 1h",
    topicHash: "0x1be8…77cd",
    members: 18,
    messages: 64,
    projectOverview: roomProjectOverviews["grants-rubric"],
    activityPreview: [
      {
        author: "Marta",
        time: "15m ago",
        excerpt:
          "Impact should be weighted higher than pure output volume or we keep rewarding teams that simply publish more updates.",
      },
      {
        author: "Theo",
        time: "33m ago",
        excerpt:
          "The rubric needs one clearer distinction between grants that are exploratory and grants that maintain critical operations.",
      },
      {
        author: "Rae",
        time: "1h ago",
        excerpt:
          "A single examples section would help applicants understand what high-quality evidence actually looks like.",
      },
    ],
  },
  {
    id: "validator-onboarding",
    title: "Validator onboarding feedback room",
    summary:
      "Your room collecting friction from first-time validator operators and missing onboarding materials.",
    category: "Operations",
    status: "live",
    createdByUser: true,
    participatedByUser: false,
    creatorName: "You",
    creatorRole: "Room creator",
    hostBoard: roomHostBoards["validator-onboarding"],
    openedAtLabel: "Opened 1d ago",
    closesAtLabel: "Closes in 3d 1h",
    topicHash: "0x5a74…00bf",
    members: 9,
    messages: 43,
    projectOverview: roomProjectOverviews["validator-onboarding"],
    activityPreview: [
      {
        author: "You",
        time: "10m ago",
        excerpt:
          "If first-time operators all fail at the same checkpoint, we should split the guide into one setup path and one verification path.",
      },
      {
        author: "Kai",
        time: "27m ago",
        excerpt:
          "Most confusion comes from missing examples around key rotation and where to verify that the change actually landed.",
      },
      {
        author: "Uma",
        time: "49m ago",
        excerpt:
          "The onboarding docs assume too much baseline infrastructure knowledge for people spinning up a first node.",
      },
    ],
  },
  {
    id: "delegation-writing",
    title: "Delegation update writing room",
    summary:
      "Your room for tightening how delegation and public governance updates are communicated to less technical readers.",
    category: "Community",
    status: "closing",
    createdByUser: true,
    participatedByUser: false,
    creatorName: "You",
    creatorRole: "Room creator",
    hostBoard: roomHostBoards["delegation-writing"],
    openedAtLabel: "Opened 2d ago",
    closesAtLabel: "Closes in 9h",
    topicHash: "0x3c09…a2d7",
    members: 12,
    messages: 58,
    projectOverview: roomProjectOverviews["delegation-writing"],
    activityPreview: [
      {
        author: "You",
        time: "14m ago",
        excerpt:
          "The current version still feels insider-heavy. I want one opening paragraph that explains the practical consequence first.",
      },
      {
        author: "Eli",
        time: "36m ago",
        excerpt:
          "The outline is strong, but the delegation rationale needs one plain-language example before the policy references.",
      },
      {
        author: "Mona",
        time: "1h ago",
        excerpt:
          "Readers who do not follow OpenGov weekly will need a short context block before the update body starts.",
      },
    ],
  },
  {
    id: "treasury-execution",
    title: "Treasury execution diary",
    summary:
      "A lower-noise room logging how treasury decisions turned into actual execution steps and delays.",
    category: "Treasury",
    status: "live",
    createdByUser: false,
    participatedByUser: false,
    creatorName: "Ops Ledger Group",
    creatorRole: "Execution tracker",
    hostBoard: roomHostBoards["treasury-execution"],
    openedAtLabel: "Opened 14h ago",
    closesAtLabel: "Closes in 4d 3h",
    topicHash: "0x77ae…9912",
    members: 11,
    messages: 31,
    projectOverview: roomProjectOverviews["treasury-execution"],
    activityPreview: [
      {
        author: "Dean",
        time: "18m ago",
        excerpt:
          "This week’s delay was not treasury-side. The vendor contract moved later than expected and the payment window shifted with it.",
      },
      {
        author: "Rosa",
        time: "43m ago",
        excerpt:
          "The log would benefit from one canonical state template so people can compare execution across very different proposals.",
      },
      {
        author: "Ken",
        time: "1h ago",
        excerpt:
          "A brief section for blockers would make the diary easier to audit later when people revisit specific approvals.",
      },
    ],
  },
  {
    id: "delegate-retrospective",
    title: "Delegate round retrospective",
    summary:
      "A replayable archive covering what delegates felt was missing from the last public reasoning round.",
    category: "OpenGov",
    status: "archived",
    createdByUser: false,
    participatedByUser: false,
    creatorName: "Delegate Commons",
    creatorRole: "Round facilitator",
    hostBoard: roomHostBoards["delegate-retrospective"],
    openedAtLabel: "Opened 6d ago",
    closesAtLabel: "Closed 2d ago",
    topicHash: "0xe621…44ad",
    members: 27,
    messages: 142,
    projectOverview: roomProjectOverviews["delegate-retrospective"],
    referendumId: "Ref #403",
    track: "Wish-For-Change",
    activityPreview: [
      {
        author: "Ivy",
        time: "Final hour",
        excerpt:
          "The final retrospective conclusion was that rationale quality improved, but the public summary lagged behind the discussion.",
      },
      {
        author: "Noel",
        time: "Earlier",
        excerpt:
          "Several delegates wanted one stronger standard for linking implementation details back to public-interest outcomes.",
      },
      {
        author: "Sara",
        time: "Earlier",
        excerpt:
          "Archive review shows the room converged faster once each delegate stated one concrete concern instead of broad sentiment.",
      },
    ],
  },
] as const;

export function getRoomById(id: string) {
  return rooms.find((room) => room.id === id);
}
