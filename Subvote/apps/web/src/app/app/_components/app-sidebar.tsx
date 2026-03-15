"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  icon: typeof OverviewIcon;
  inactiveCompactTone?: string;
  inactiveExpandedTone?: string;
  label: string;
};

const navItems: readonly NavItem[] = [
  {
    href: "/app",
    label: "Overview",
    icon: OverviewIcon,
  },
  {
    href: "/app/get-vp",
    label: "Get VP",
    icon: VotePowerIcon,
  },
  {
    href: "/app/square",
    label: "Square",
    icon: SquareIcon,
    inactiveCompactTone:
      "border-amber-200/80 bg-[rgba(254,243,199,0.76)] text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] hover:border-amber-300/80 hover:bg-[rgba(255,251,235,0.94)] hover:text-amber-950",
    inactiveExpandedTone:
      "border-amber-200/70 bg-[rgba(255,251,235,0.76)] text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] hover:border-amber-300/70 hover:bg-[rgba(255,251,235,0.96)] hover:text-amber-950",
  },
  {
    href: "/app/new-topic",
    label: "New Topic",
    icon: NewTopicIcon,
    inactiveCompactTone:
      "border-sky-200/80 bg-[rgba(219,234,254,0.7)] text-sky-900 shadow-[0_10px_24px_rgba(59,130,246,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] hover:border-sky-300/80 hover:bg-[rgba(239,246,255,0.9)] hover:text-sky-950",
    inactiveExpandedTone:
      "border-sky-200/70 bg-[rgba(239,246,255,0.72)] text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] hover:border-sky-300/70 hover:bg-[rgba(239,246,255,0.92)] hover:text-sky-950",
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: SettingsIcon,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expanded = searchParams.get("nav") !== "compact";

  const toggleSidebar = () => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (expanded) {
      nextSearchParams.set("nav", "compact");
    } else {
      nextSearchParams.delete("nav");
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const expandedToggleButton = (
    <button
      type="button"
      onClick={toggleSidebar}
      className="border-black/8 flex size-10 shrink-0 items-center justify-center rounded-xl border bg-neutral-950 text-white shadow-[0_12px_24px_rgba(15,17,17,0.16)] transition-[background-color,border-color,box-shadow,transform,color] duration-200 [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] motion-reduce:transition-none"
      aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
      aria-expanded={expanded}
      aria-controls="app-sidebar-nav"
    >
      <ChevronIcon expanded={expanded} />
    </button>
  );

  return (
    <aside
      className={`m-4 flex h-[calc(100vh-2rem)] shrink-0 flex-col rounded-[2rem] border border-white/20 bg-white/30 p-3 shadow-[0_30px_80px_rgba(33,37,39,0.12)] backdrop-blur-xl sm:sticky sm:top-4 ${
        expanded
          ? "border-black/6 w-[min(18rem,calc(100vw-2rem))] bg-[rgba(247,243,236,0.72)] shadow-[0_30px_90px_rgba(24,27,32,0.14)] sm:w-72"
          : "border-black/8 w-[5.7rem] bg-[rgba(247,243,236,0.88)] shadow-[0_24px_70px_rgba(24,27,32,0.12)]"
      }`}
    >
      <div
        className={`${
          expanded
            ? "border-black/6 flex items-center justify-between gap-3 rounded-[1.6rem] border bg-[rgba(255,255,255,0.7)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            : "flex flex-col items-center gap-3 overflow-visible px-0 py-1"
        }`}
      >
        <div
          className={`flex min-w-0 items-center ${
            expanded
              ? "gap-3"
              : "relative w-full justify-center overflow-visible"
          }`}
        >
          <div
            className={`flex shrink-0 items-center justify-center bg-neutral-950 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
              expanded
                ? "size-11 rounded-2xl"
                : "size-[3.75rem] rounded-[1.45rem]"
            }`}
          >
            SV
          </div>

          {expanded ? (
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-[-0.03em] text-neutral-950">
                subvote
              </p>
              <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                app shell
              </p>
            </div>
          ) : null}

          {!expanded ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute left-[calc(50%+1.25rem)] top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-neutral-700 shadow-none transition-[color,transform] duration-200 [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] hover:translate-x-0.5 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] motion-reduce:transition-none"
              aria-label="Expand sidebar"
              aria-expanded={false}
              aria-controls="app-sidebar-nav"
            >
              <ChevronIcon expanded={false} />
            </button>
          ) : null}
        </div>

        {expanded ? expandedToggleButton : null}
      </div>

      <nav
        id="app-sidebar-nav"
        className="mt-5 flex flex-col gap-3"
        aria-label="Primary"
      >
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {navItems.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);

            const Icon = item.icon;
            const href = expanded ? item.href : `${item.href}?nav=compact`;
            const inactiveClasses = expanded
              ? (item.inactiveExpandedTone ??
                "border-black/8 bg-[rgba(255,255,255,0.72)] text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] hover:border-black/12 hover:bg-white hover:text-neutral-950")
              : (item.inactiveCompactTone ??
                "border-black/8 bg-[rgba(255,255,255,0.78)] text-neutral-900 shadow-[0_10px_24px_rgba(15,17,17,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] hover:border-black/12 hover:bg-white hover:text-neutral-950");

            return (
              <li key={item.href}>
                <Link
                  href={href}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  title={!expanded ? item.label : undefined}
                  className={`group flex border transition-[background-color,border-color,color,box-shadow,transform] duration-200 [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] motion-reduce:transition-none ${
                    expanded
                      ? "h-[4.2rem] w-full items-center justify-start gap-4 rounded-[1.55rem] px-4 py-0"
                      : "mx-auto size-[4.2rem] items-center justify-center rounded-[1.55rem] p-0"
                  } ${
                    isActive
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_18px_36px_rgba(15,17,17,0.18)]"
                      : inactiveClasses
                  }`}
                >
                  <span
                    className={`flex shrink-0 items-center justify-center transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none ${
                      expanded
                        ? "size-auto rounded-none"
                        : "size-auto rounded-none"
                    } ${
                      isActive
                        ? expanded
                          ? "bg-transparent text-white shadow-none"
                          : "bg-transparent text-white shadow-none"
                        : expanded
                          ? "bg-transparent text-neutral-900 shadow-none"
                          : "bg-transparent text-neutral-900 shadow-none"
                    }`}
                  >
                    <Icon />
                  </span>

                  {expanded ? (
                    <span
                      className={`flex h-full items-center overflow-hidden whitespace-nowrap text-sm font-semibold leading-none tracking-[-0.01em] ${
                        isActive ? "text-white" : "text-neutral-950"
                      }`}
                    >
                      {item.label}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

function OverviewIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.75 4.75H10.25V10.25H4.75V4.75ZM13.75 4.75H19.25V10.25H13.75V4.75ZM4.75 13.75H10.25V19.25H4.75V13.75ZM13.75 13.75H19.25V19.25H13.75V13.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VotePowerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.75L14.35 8.52L19.62 9.29L15.81 13L16.71 18.23L12 15.75L7.29 18.23L8.19 13L4.38 9.29L9.65 8.52L12 3.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.5 5.75H16.5C18.57 5.75 20.25 7.43 20.25 9.5V14.5C20.25 16.57 18.57 18.25 16.5 18.25H12.5L8 20.25V18.25H7.5C5.43 18.25 3.75 16.57 3.75 14.5V9.5C3.75 7.43 5.43 5.75 7.5 5.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 12H16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NewTopicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5.25V18.75M5.25 12H18.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect
        x="3.75"
        y="3.75"
        width="16.5"
        height="16.5"
        rx="4.25"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9.21 4.85C9.5 3.93 10.36 3.25 11.34 3.25H12.66C13.64 3.25 14.5 3.93 14.79 4.85L14.99 5.49C15.15 5.99 15.57 6.37 16.08 6.48L16.75 6.63C17.71 6.84 18.43 7.58 18.63 8.54L18.78 9.21C18.89 9.72 19.27 10.14 19.77 10.3L20.41 10.5C21.33 10.79 22.01 11.65 22.01 12.63V13.37C22.01 14.35 21.33 15.21 20.41 15.5L19.77 15.7C19.27 15.86 18.89 16.28 18.78 16.79L18.63 17.46C18.43 18.42 17.71 19.16 16.75 19.37L16.08 19.52C15.57 19.63 15.15 20.01 14.99 20.51L14.79 21.15C14.5 22.07 13.64 22.75 12.66 22.75H11.34C10.36 22.75 9.5 22.07 9.21 21.15L9.01 20.51C8.85 20.01 8.43 19.63 7.92 19.52L7.25 19.37C6.29 19.16 5.57 18.42 5.37 17.46L5.22 16.79C5.11 16.28 4.73 15.86 4.23 15.7L3.59 15.5C2.67 15.21 1.99 14.35 1.99 13.37V12.63C1.99 11.65 2.67 10.79 3.59 10.5L4.23 10.3C4.73 10.14 5.11 9.72 5.22 9.21L5.37 8.54C5.57 7.58 6.29 6.84 7.25 6.63L7.92 6.48C8.43 6.37 8.85 5.99 9.01 5.49L9.21 4.85Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="13" r="3.1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-300 ${
        expanded ? "rotate-0" : "rotate-180"
      }`}
    >
      <path
        d="M14.5 6.75L9.25 12L14.5 17.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
