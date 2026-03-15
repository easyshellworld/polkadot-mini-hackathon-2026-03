import type { ReactNode } from "react";

import { FloatingReturnHandle } from "./_components/floating-return-handle";

import { getRoomOrThrow } from "@/app/app/_lib/get-room";

type RoomLayoutProps = {
  children: ReactNode;
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomLayout({
  children,
  params,
}: RoomLayoutProps) {
  const { roomId } = await params;
  getRoomOrThrow(roomId);

  return (
    <div className="relative flex min-h-screen w-full flex-col gap-0 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,255,255,0.78),transparent_18%),radial-gradient(circle_at_78%_20%,rgba(186,230,253,0.18),transparent_22%),radial-gradient(circle_at_72%_68%,rgba(253,230,138,0.16),transparent_24%),radial-gradient(circle_at_28%_88%,rgba(255,255,255,0.36),transparent_26%)]"
      />

      <FloatingReturnHandle
        href={`/app/square?room=${roomId}`}
        label="Back to square"
      />

      <div className="relative z-10 w-full px-4 lg:px-8">{children}</div>
    </div>
  );
}
