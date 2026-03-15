"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type ReactNode,
  startTransition,
  useDeferredValue,
  useId,
  useMemo,
  useState,
} from "react";

import {
  getRoomById,
  rooms,
  type SquareRoom,
  type TopicCategory,
  type TopicStatus,
} from "@/app/app/_lib/mock-rooms";
import { UnderlineMark } from "@/app/app/_components/text-marks";

type TopicCategoryFilter = "all" | TopicCategory;
type TopicStatusFilter = "all" | TopicStatus;
type UserRoomFilter = "all" | "joined" | "created";

const categoryFilters: readonly {
  id: TopicCategoryFilter;
  label: string;
}[] = [
  { id: "all", label: "All topics" },
  { id: "OpenGov", label: "OpenGov" },
  { id: "Treasury", label: "Treasury" },
  { id: "Protocol", label: "Protocol" },
  { id: "Community", label: "Community" },
  { id: "Operations", label: "Operations" },
] as const;

const statusFilters: readonly {
  id: TopicStatusFilter;
  label: string;
}[] = [
  { id: "all", label: "All states" },
  { id: "live", label: "Live" },
  { id: "closing", label: "Closing soon" },
  { id: "archived", label: "Archived" },
] as const;

export default function SquarePage() {
  const overviewId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const navQuery = searchParams.get("nav");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<TopicCategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<TopicStatusFilter>("live");
  const [userRoomFilter, setUserRoomFilter] = useState<UserRoomFilter>("all");
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const selectedRoom = getRoomById(searchParams.get("room") ?? "") ?? null;

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const queryMatch =
        !normalizedQuery ||
        [room.title, room.summary, room.category]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const categoryMatch =
        categoryFilter === "all" || room.category === categoryFilter;
      const statusMatch =
        statusFilter === "all" || room.status === statusFilter;
      const userRoomMatch =
        userRoomFilter === "all" ||
        (userRoomFilter === "joined" && room.participatedByUser) ||
        (userRoomFilter === "created" && room.createdByUser);

      return queryMatch && categoryMatch && statusMatch && userRoomMatch;
    });
  }, [categoryFilter, normalizedQuery, statusFilter, userRoomFilter]);

  const liveCount = rooms.filter((room) => room.status !== "archived").length;
  const myTopicsCount = rooms.filter((room) => room.createdByUser).length;
  const joinedRoomsCount = rooms.filter(
    (room) => room.participatedByUser,
  ).length;

  const boardOverviewItems = [
    {
      label: "Browse",
      value: String(liveCount),
      copy: "Live rooms are open for discussion across the board.",
    },
    {
      label: "Filter",
      value: "5",
      copy: "Topic classes help narrow the room floor quickly.",
    },
    {
      label: "Track",
      value: String(myTopicsCount),
      copy: "Rooms you started stay visible while the board shifts.",
    },
    {
      label: "Visible now",
      value: String(filteredRooms.length),
      copy: "Rooms matching the current search and state controls.",
    },
  ] as const;

  const updateRoomInQuery = (roomId?: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (roomId) {
      nextParams.set("room", roomId);
    } else {
      nextParams.delete("room");
    }

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-none flex-col px-0 pb-14">
      <div className="flex flex-col gap-5 pt-1 sm:gap-6">
        <section className="pt-1">
          <p className="mb-3 font-serif text-[1.05rem] font-medium italic tracking-[0.04em] text-slate-600/80">
            Square
          </p>

          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                setIsOverviewOpen((open) => !open);
              });
            }}
            aria-controls={overviewId}
            aria-expanded={isOverviewOpen}
            className="border-black/8 w-full rounded-[1.9rem] border bg-[rgba(255,255,255,0.74)] px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] sm:px-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  {isOverviewOpen
                    ? "Square overview open"
                    : "Square overview folded"}
                </p>
                <p className="mt-3 max-w-4xl text-[1rem] leading-7 text-neutral-600 sm:text-[1.05rem]">
                  {isOverviewOpen
                    ? "Tap anywhere on this introduction panel to fold the square overview back into its compact state."
                    : "Tap anywhere on this introduction panel to unfold the full square overview, including the board headline, participation cues, and discovery logic."}
                </p>
              </div>

              <span className="border-black/8 bg-white/72 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${
                    isOverviewOpen ? "bg-emerald-400" : "bg-neutral-300"
                  }`}
                />
                {isOverviewOpen ? "Expanded" : "Collapsed"}
              </span>
            </div>
          </button>

          <div
            id={overviewId}
            aria-hidden={!isOverviewOpen}
            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isOverviewOpen
                ? "mt-4 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div
              className={`overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isOverviewOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-4 opacity-0"
              }`}
            >
              <div className="relative px-0 pb-3 pt-1">
                <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_37rem] xl:items-start xl:gap-10">
                  <div className="min-w-0">
                    <h1 className="max-w-[11ch] text-[clamp(3rem,6.6vw,5.8rem)] font-normal leading-[0.9] tracking-[-0.085em] text-neutral-950">
                      Browse live{" "}
                      <UnderlineMark tone="sage">topics</UnderlineMark> and
                      enter the right room.
                    </h1>
                    <p className="mt-5 max-w-5xl text-[1rem] leading-7 text-neutral-600 sm:text-[1.08rem]">
                      Square is the board for active discussion rooms. Use{" "}
                      <AccentPill tone="sky">live rooms</AccentPill> to spot
                      what is moving now, switch by{" "}
                      <UnderlineMark tone="sky">category</UnderlineMark>, and
                      keep your <AccentPill tone="amber">own topics</AccentPill>{" "}
                      visible while you decide which room to enter next.
                    </p>
                  </div>

                  <BoardOverviewPanel items={boardOverviewItems} />
                </div>

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,rgba(15,17,17,0),rgba(15,17,17,0.14)_12%,rgba(15,17,17,0.28)_50%,rgba(245,158,11,0.2)_72%,rgba(15,17,17,0)_100%)]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-black/8 rounded-[1.6rem] border bg-[rgba(255,255,255,0.74)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                Explore
              </p>
              <p className="mt-1.5 max-w-[52rem] text-[0.95rem] leading-6 text-neutral-600">
                Search the floor, filter by topic class, and narrow the board
                before you pick a room.
              </p>
            </div>

            <label className="border-black/8 flex min-h-11 w-full items-center gap-2.5 rounded-full border bg-[rgba(247,243,236,0.84)] px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] xl:max-w-[19rem]">
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    setQuery(nextValue);
                  });
                }}
                placeholder="Search topic, category, or creator"
                className="w-full bg-transparent text-[0.95rem] text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                Categories
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {categoryFilters.map((filter) => {
                  const isActive = filter.id === categoryFilter;
                  const count =
                    filter.id === "all"
                      ? rooms.length
                      : rooms.filter((room) => room.category === filter.id)
                          .length;

                  return (
                    <FilterChip
                      key={filter.id}
                      active={isActive}
                      count={count}
                      label={filter.label}
                      onClick={() => {
                        startTransition(() => {
                          setCategoryFilter(filter.id);
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  Room state
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {statusFilters.map((filter) => {
                    const isActive = filter.id === statusFilter;
                    const count =
                      filter.id === "all"
                        ? rooms.length
                        : rooms.filter((room) => room.status === filter.id)
                            .length;

                    return (
                      <FilterChip
                        key={filter.id}
                        active={isActive}
                        count={count}
                        label={filter.label}
                        onClick={() => {
                          startTransition(() => {
                            setStatusFilter(filter.id);
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  My rooms
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <FilterChip
                    active={userRoomFilter === "joined"}
                    count={joinedRoomsCount}
                    label="Joined"
                    onClick={() => {
                      startTransition(() => {
                        setUserRoomFilter((current) =>
                          current === "joined" ? "all" : "joined",
                        );
                      });
                    }}
                  />
                  <FilterChip
                    active={userRoomFilter === "created"}
                    count={myTopicsCount}
                    label="Started"
                    onClick={() => {
                      startTransition(() => {
                        setUserRoomFilter((current) =>
                          current === "created" ? "all" : "created",
                        );
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`grid gap-4 pt-1 ${
            selectedRoom
              ? "xl:grid-cols-[minmax(0,1fr)_31rem] xl:items-start"
              : ""
          }`}
        >
          <div className="order-2 xl:order-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  Room floor
                </p>
                <p className="mt-1 max-w-3xl text-[0.95rem] leading-6 text-neutral-600">
                  {selectedRoom
                    ? "Each block is a room. Keep browsing on the left while the active conversation stays available on the right."
                    : "Each block is a room. Open one from the floor to inspect its conversation without leaving the board."}
                </p>
              </div>
              <p className="text-[0.82rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                {filteredRooms.length} visible rooms
              </p>
            </div>

            {filteredRooms.length > 0 ? (
              <div
                className={`mt-4 grid items-start gap-3 ${
                  selectedRoom
                    ? "sm:grid-cols-2 xl:grid-cols-2"
                    : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
                }`}
              >
                {filteredRooms.map((room) => (
                  <RoomTile
                    key={room.id}
                    active={selectedRoom?.id === room.id}
                    onOpen={() => {
                      updateRoomInQuery(
                        selectedRoom?.id === room.id ? undefined : room.id,
                      );
                    }}
                    room={room}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.8rem] bg-[rgba(247,243,236,0.72)] px-5 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  No rooms match
                </p>
                <p className="mt-2 max-w-xl text-[1rem] leading-7 text-neutral-600">
                  Reset one of the active filters or broaden the search to bring
                  rooms back onto the floor.
                </p>
              </div>
            )}
          </div>

          {selectedRoom ? (
            <div className="order-1 xl:sticky xl:top-6 xl:order-2">
              <RoomChatPanel room={selectedRoom} navQuery={navQuery} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function BoardOverviewPanel({
  items,
}: {
  items: readonly {
    copy: string;
    label: string;
    value: string;
  }[];
}) {
  return (
    <aside className="border-black/8 rounded-[2rem] border bg-[rgba(255,255,255,0.74)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
          This board lets you
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <OverviewPanelCard
            key={item.label}
            copy={item.copy}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>
    </aside>
  );
}

function OverviewPanelCard({
  copy,
  label,
  value,
}: {
  copy: string;
  label: string;
  value: string;
}) {
  return (
    <div className="border-black/7 rounded-[1.55rem] border bg-[rgba(247,243,236,0.82)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
          {label}
        </p>
        <span className="rounded-full bg-[rgba(250,232,179,0.86)] px-3 py-1 text-[1rem] font-medium leading-none tracking-[-0.03em] text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          {value}
        </span>
      </div>
      <p className="mt-3 max-w-[32ch] text-[1rem] leading-8 text-neutral-700 sm:text-[1.05rem]">
        {copy}
      </p>
    </div>
  );
}

function AccentPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "amber" | "sky";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 align-middle text-[0.9em] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ${
        tone === "amber"
          ? "bg-[rgba(250,232,179,0.82)] text-neutral-900"
          : "bg-[rgba(220,233,247,0.88)] text-sky-950"
      }`}
    >
      {children}
    </span>
  );
}

function RoomChatPanel({
  room,
  navQuery,
}: {
  room: SquareRoom | null;
  navQuery: string | null;
}) {
  if (!room) {
    return null;
  }

  const joined = room.participatedByUser || room.createdByUser;
  const baseMessageCost = room.category === "OpenGov" ? 8 : 5;
  const previewItems = room.activityPreview.slice(
    0,
    room.status === "archived" ? 2 : 3,
  );
  const previewAction = getRoomPreviewAction(room, baseMessageCost);

  return (
    <aside className="border-black/8 rounded-[2rem] border bg-[rgba(255,255,255,0.78)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] sm:p-6">
      <DockHeader room={room} />

      <div className="mt-5 grid gap-2">
        <DockStat
          label="Base cost"
          value={`${baseMessageCost} VP`}
          tone="amber"
        />
        <DockStat label="Members" value={String(room.members)} tone="sky" />
        <DockStat
          label="Messages"
          value={String(room.messages)}
          tone="neutral"
        />
      </div>

      <div className="mt-5 rounded-[1.55rem] bg-[rgba(247,243,236,0.82)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
            {previewAction.eyebrow}
          </p>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
            {room.status === "archived" ? "Replay only" : room.closesAtLabel}
          </p>
        </div>
        <p className="mt-3 text-[1rem] leading-7 text-neutral-700">
          {previewAction.copy}
        </p>
        <Link
          href={
            navQuery === "compact"
              ? `/app/rooms/${room.id}?nav=compact`
              : `/app/rooms/${room.id}`
          }
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-neutral-950 bg-neutral-950 px-4 py-2 text-[0.95rem] font-semibold !text-white shadow-[0_16px_32px_rgba(15,17,17,0.18)] transition-[background-color,box-shadow,transform,color] duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-[0_20px_36px_rgba(15,17,17,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)]"
        >
          {previewAction.cta}
        </Link>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
            Activity preview
          </p>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
            Latest {previewItems.length}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {previewItems.map((item) => (
            <ReplayBubble key={`${item.author}-${item.time}`} item={item} />
          ))}
        </div>
        {!joined && room.status !== "archived" ? (
          <p className="mt-4 text-[0.88rem] leading-6 text-neutral-500">
            Preview first, then join from the room page when you are ready to
            speak.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function DockHeader({ room }: { room: SquareRoom }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
            Active room
          </p>
          <h2 className="mt-3 max-w-[10ch] text-[2.25rem] font-semibold leading-[0.92] tracking-[-0.07em] text-neutral-950">
            {room.title}
          </h2>
        </div>
        <div className="bg-white/78 rounded-full px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
          {room.topicHash}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RoomLabel tone={getStatusTone(room.status)} variant="status">
          {getStatusLabel(room.status)}
        </RoomLabel>
        <RoomLabel
          tone={getRoomTone(room.category).category}
          variant="category"
        >
          {room.category}
        </RoomLabel>
        {room.participatedByUser ? (
          <RoomLabel tone="neutral" variant="meta">
            Joined
          </RoomLabel>
        ) : null}
        {room.createdByUser ? (
          <RoomLabel tone="amber" variant="meta">
            Started
          </RoomLabel>
        ) : null}
      </div>

      <p className="mt-4 text-[0.98rem] leading-7 text-neutral-600">
        {room.summary}
      </p>
    </div>
  );
}

function DockStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "amber" | "neutral" | "sky";
  value: string;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-[rgba(250,232,179,0.72)]"
      : tone === "sky"
        ? "bg-[rgba(220,233,247,0.82)]"
        : "bg-[rgba(247,243,236,0.82)]";

  return (
    <div
      className={`rounded-[1.2rem] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] ${toneClass}`}
    >
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-[1.2rem] font-semibold leading-none tracking-[-0.05em] text-neutral-950">
        {value}
      </p>
    </div>
  );
}

function ReplayBubble({
  item,
}: {
  item: SquareRoom["activityPreview"][number];
}) {
  return (
    <article className="rounded-[1.4rem] bg-[rgba(247,243,236,0.82)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-neutral-700">
          {item.author}
        </p>
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {item.time}
        </p>
      </div>
      <p className="mt-3 text-[0.98rem] leading-7 text-neutral-700">
        {item.excerpt}
      </p>
    </article>
  );
}

function RoomTile({
  active = false,
  onOpen,
  room,
}: {
  active?: boolean;
  onOpen: () => void;
  room: SquareRoom;
}) {
  const layout = getRoomTileLayout(room);
  const tone = getRoomTone(room.category);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open room ${room.title}`}
      className={`relative block min-h-[14.5rem] overflow-hidden rounded-[1.9rem] px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition-[box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] sm:min-h-0 sm:px-4 sm:py-4 ${tone.panel} ${layout.article} ${
        active
          ? "ring-neutral-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_0_0_1px_rgba(15,17,17,0.08)] ring-1"
          : ""
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 bottom-0 h-24 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.32),rgba(255,255,255,0)_72%)]"
      />

      <div className="relative flex flex-col">
        <div className="flex flex-wrap items-start gap-2">
          <RoomLabel tone={tone.status} variant="status">
            {getStatusLabel(room.status)}
          </RoomLabel>
          <RoomLabel tone={tone.category} variant="category">
            {room.category}
          </RoomLabel>
          {room.participatedByUser ? (
            <RoomLabel tone="neutral" variant="meta">
              Joined
            </RoomLabel>
          ) : null}
          {room.createdByUser ? (
            <RoomLabel tone="amber" variant="meta">
              Started
            </RoomLabel>
          ) : null}
        </div>

        <div className="mt-4">
          <h2
            className={`font-semibold leading-[0.94] tracking-[-0.07em] text-neutral-950 ${layout.title}`}
          >
            {room.title}
          </h2>
          <p className="mt-3 text-[0.96rem] leading-6 text-neutral-700">
            {room.summary}
          </p>
        </div>

        <div className="mt-6 flex items-end justify-between gap-3">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-neutral-500">
            {getRoomFooter(room)}
          </p>
          <div className="bg-white/74 rounded-full px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
            {active ? "Close" : "Enter"}
          </div>
        </div>
      </div>
    </button>
  );
}

function getRoomTileLayout(room: SquareRoom) {
  const relationshipWeight =
    (room.createdByUser ? 18 : 0) + (room.participatedByUser ? 14 : 0);
  const contentScore =
    room.title.length * 1.45 + room.summary.length * 0.55 + relationshipWeight;

  if (contentScore >= 110) {
    return {
      article: "sm:col-span-2",
      title: "text-[1.9rem] sm:text-[2.25rem]",
    };
  }

  if (contentScore >= 92) {
    return {
      article: "lg:col-span-2",
      title: "text-[1.8rem] sm:text-[2.05rem]",
    };
  }

  return {
    article: "",
    title: "text-[1.65rem] sm:text-[1.85rem]",
  };
}

function RoomLabel({
  children,
  tone,
  variant,
}: {
  children: ReactNode;
  tone: "amber" | "emerald" | "neutral" | "sky" | "teal";
  variant: "category" | "meta" | "status";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-[rgba(214,246,230,0.9)] text-emerald-950"
      : tone === "sky"
        ? "bg-[rgba(220,233,247,0.92)] text-sky-950"
        : tone === "teal"
          ? "bg-[rgba(215,241,234,0.92)] text-teal-950"
          : tone === "amber"
            ? "bg-[rgba(250,232,179,0.88)] text-amber-950"
            : "bg-white/72 text-neutral-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] ${toneClass} ${
        variant === "meta" ? "tracking-[0.16em]" : ""
      }`}
    >
      {children}
    </span>
  );
}

function getRoomFooter(room: SquareRoom) {
  if (room.createdByUser) {
    return "Room you started";
  }

  if (room.participatedByUser) {
    return "Room you joined";
  }

  if (room.status === "archived") {
    return "Replay available";
  }

  return "Open to browse";
}

function getStatusLabel(status: TopicStatus) {
  if (status === "closing") {
    return "Closing";
  }

  if (status === "archived") {
    return "Archived";
  }

  return "Live";
}

function getStatusTone(status: TopicStatus) {
  if (status === "closing") {
    return "amber" as const;
  }

  if (status === "archived") {
    return "neutral" as const;
  }

  return "emerald" as const;
}

function getRoomPreviewAction(room: SquareRoom, baseMessageCost: number) {
  if (room.status === "archived") {
    return {
      copy: "This room is already closed. The final signals stay preview-only here inside the square.",
      cta: "Review archive",
      eyebrow: "Archive preview",
    };
  }

  if (room.createdByUser || room.participatedByUser) {
    return {
      copy: `You are already in this room. Messages start at ${baseMessageCost} VP, and the latest discussion is previewed below.`,
      cta: "Start discussion",
      eyebrow: "Ready now",
    };
  }

  return {
    copy: `Scan the latest signals first, then join when you are ready to speak. Entry starts at ${baseMessageCost} VP per message.`,
    cta: "Join room",
    eyebrow: "Join gate",
  };
}

function getRoomTone(category: TopicCategory) {
  if (category === "OpenGov") {
    return {
      panel:
        "bg-[linear-gradient(180deg,rgba(226,236,248,0.9),rgba(239,244,250,0.82))]",
      category: "sky" as const,
      status: "emerald" as const,
    };
  }

  if (category === "Treasury") {
    return {
      panel:
        "bg-[linear-gradient(180deg,rgba(226,241,233,0.88),rgba(238,246,241,0.84))]",
      category: "teal" as const,
      status: "emerald" as const,
    };
  }

  if (category === "Protocol") {
    return {
      panel:
        "bg-[linear-gradient(180deg,rgba(229,234,247,0.9),rgba(241,243,250,0.84))]",
      category: "sky" as const,
      status: "emerald" as const,
    };
  }

  if (category === "Community") {
    return {
      panel:
        "bg-[linear-gradient(180deg,rgba(247,233,235,0.88),rgba(249,242,243,0.84))]",
      category: "amber" as const,
      status: "emerald" as const,
    };
  }

  return {
    panel:
      "bg-[linear-gradient(180deg,rgba(225,242,236,0.88),rgba(240,247,244,0.84))]",
    category: "teal" as const,
    status: "emerald" as const,
  };
}

function FilterChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.95rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)] ${
        active
          ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_12px_24px_rgba(15,17,17,0.1)]"
          : "border-black/8 bg-[rgba(247,243,236,0.84)] text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[0.68rem] ${
          active ? "bg-white/12 text-white" : "bg-white text-neutral-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-neutral-400"
    >
      <path
        d="M11 18.25C15.0041 18.25 18.25 15.0041 18.25 11C18.25 6.99594 15.0041 3.75 11 3.75C6.99594 3.75 3.75 6.99594 3.75 11C3.75 15.0041 6.99594 18.25 11 18.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M16.5 16.5L20.25 20.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
