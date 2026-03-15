import type { Metadata } from "next";

import {
  FloatingRoomStage,
  type FloatingRoomMessage,
} from "./_components/floating-room-stage";

import { getRoomOrThrow } from "@/app/app/_lib/get-room";
import { rooms, type SquareRoom } from "@/app/app/_lib/mock-rooms";

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return rooms.map((room) => ({
    roomId: room.id,
  }));
}

export async function generateMetadata({
  params,
}: RoomPageProps): Promise<Metadata> {
  const { roomId } = await params;
  const room = getRoomOrThrow(roomId);

  return {
    description: room.summary,
    title: `${room.title} | subvote`,
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  const room = getRoomOrThrow(roomId);

  return <FloatingRoomStage messages={buildFloatingMessages(room)} room={room} />;
}

function buildFloatingMessages(room: SquareRoom): FloatingRoomMessage[] {
  const stateCopy =
    room.status === "archived"
      ? `This room is now archive-only. ${room.messages} messages remain readable in the field.`
      : room.createdByUser
        ? `You opened this room. ${room.members} members are already following the latest thread.`
        : room.participatedByUser
          ? "You are already in this room. The latest discussion is active and open for contribution."
          : "You have not joined this room yet. Read the discussion first, then decide whether to enter.";

  const previewSource = room.activityPreview.length
    ? room.activityPreview
    : [
        {
          author: room.creatorName,
          excerpt: room.summary,
          time: room.openedAtLabel,
        },
      ];
  const previewTarget = Math.max(0, room.messages - 2);
  const previewMessages: FloatingRoomMessage[] = Array.from({
    length: previewTarget,
  }).map((_, index) => {
    const item = previewSource[index % previewSource.length]!;
    const cycle = Math.floor(index / previewSource.length);

    return {
      author: item.author,
      copy: cycle === 0 ? item.excerpt : buildExpandedExcerpt(item.excerpt, cycle),
      id: `${room.id}-${item.author}-${item.time}-${index}`,
      label:
        item.author === "You"
          ? cycle === 0
            ? "Your signal"
            : "Follow-up"
          : cycle === 0
            ? "Recent message"
            : "Thread update",
      time: item.time,
      tone: item.author === "You" ? "self" : "peer",
    };
  });

  return [
    {
      author: room.creatorName,
      copy: room.summary,
      id: `${room.id}-summary`,
      label: room.creatorRole,
      time: room.openedAtLabel,
      tone: "host",
    },
    ...previewMessages,
    {
      author: room.status === "archived" ? "Archive" : "Room state",
      copy: stateCopy,
      id: `${room.id}-state`,
      label: room.category,
      time: room.closesAtLabel,
      tone: "system",
    },
  ];
}

function buildExpandedExcerpt(excerpt: string, cycle: number) {
  const variants = [
    `Additional context: ${excerpt}`,
    `Follow-up note: ${excerpt}`,
    `Cross-check: ${excerpt}`,
    `Thread summary: ${excerpt}`,
  ];

  return variants[(cycle - 1) % variants.length] ?? excerpt;
}
