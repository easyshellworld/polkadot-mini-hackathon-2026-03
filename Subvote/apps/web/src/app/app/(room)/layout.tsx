import type { ReactNode } from "react";

export default function RoomShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <main className="min-h-screen">{children}</main>;
}
