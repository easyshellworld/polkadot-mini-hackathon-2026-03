"use client";

import Link from "next/link";
import { Fragment } from "react";

import { ExpandablePanel } from "./expandable-panel";

import type { RoomRichTextBlock, RoomRichTextSpan } from "@/app/app/_lib/mock-rooms";

type RoomProjectIntroProps = {
  blocks: readonly RoomRichTextBlock[];
};

export function RoomProjectIntro({ blocks }: RoomProjectIntroProps) {
  return (
    <div className="mt-4 max-w-3xl">
      <ExpandablePanel
        expandLabel="Expand project brief"
        collapseLabel="Collapse project brief"
        contentClassName="space-y-4 text-[1rem] leading-7 text-neutral-700 sm:text-[1.06rem]"
        header={
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
            Project brief
          </p>
        }
      >
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h2
                key={`heading-${index}`}
                className="text-[1.08rem] font-semibold tracking-[-0.03em] text-neutral-950"
              >
                {renderRichText(block.content)}
              </h2>
            );
          }

          if (block.type === "list") {
            return (
              <ul
                key={`list-${index}`}
                className="space-y-2.5 pl-5 text-neutral-700 marker:text-neutral-400"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`item-${index}-${itemIndex}`}>
                    {renderRichText(item)}
                  </li>
                ))}
              </ul>
            );
          }

          if (block.type === "callout") {
            return (
              <div
                key={`callout-${index}`}
                className="rounded-[1.35rem] bg-[rgba(255,252,244,0.72)] px-4 py-3 shadow-[0_12px_30px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-[10px]"
              >
                <p className="text-[0.66rem] font-medium uppercase tracking-[0.24em] text-neutral-500">
                  {block.label}
                </p>
                <p className="mt-2 text-[0.98rem] leading-7 text-neutral-700">
                  {renderRichText(block.content)}
                </p>
              </div>
            );
          }

          if (block.type === "quote") {
            return (
              <blockquote
                key={`quote-${index}`}
                className="border-l border-black/10 pl-4 text-[0.98rem] italic leading-7 text-neutral-600"
              >
                <p>{renderRichText(block.content)}</p>
                {block.source ? (
                  <footer className="mt-2 text-[0.76rem] not-italic uppercase tracking-[0.2em] text-neutral-500">
                    {renderRichText(block.source)}
                  </footer>
                ) : null}
              </blockquote>
            );
          }

          return <p key={`paragraph-${index}`}>{renderRichText(block.content)}</p>;
        })}
      </ExpandablePanel>
    </div>
  );
}

function renderRichText(spans: readonly RoomRichTextSpan[]) {
  return spans.map((span, index) => {
    const className =
      span.tone === "strong"
        ? "font-semibold text-neutral-950"
        : span.tone === "accent"
          ? "font-medium text-neutral-950"
          : span.tone === "muted"
            ? "text-neutral-500"
            : "text-neutral-700";

    if (span.href) {
      return (
        <Fragment key={`${span.text}-${index}`}>
          <Link
            href={span.href}
            className={`underline decoration-black/20 underline-offset-4 transition-colors duration-200 hover:text-neutral-950 ${className}`}
          >
            {span.text}
          </Link>
        </Fragment>
      );
    }

    return (
      <span key={`${span.text}-${index}`} className={className}>
        {span.text}
      </span>
    );
  });
}
