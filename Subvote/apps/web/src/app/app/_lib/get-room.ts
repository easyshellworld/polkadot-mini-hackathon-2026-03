import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { getRoomById } from "@/app/app/_lib/mock-rooms";

export const getRoomOrThrow = cache((roomId: string) => {
  const room = getRoomById(roomId);

  if (!room) {
    notFound();
  }

  return room;
});
