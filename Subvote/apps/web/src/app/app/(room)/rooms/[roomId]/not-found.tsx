import Link from "next/link";

export default function RoomNotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col gap-6">
      <Link
        href="/app/square"
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-black/8 bg-[rgba(255,255,255,0.76)] px-4 py-2 text-[0.9rem] font-semibold text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(243,239,230,0.96)]"
      >
        Back to square
      </Link>
    </div>
  );
}
