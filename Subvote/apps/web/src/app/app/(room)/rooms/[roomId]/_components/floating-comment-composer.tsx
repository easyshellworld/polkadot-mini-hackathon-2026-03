"use client";

import {
  Bold,
  Italic,
  Link2,
  List,
  MessageSquareQuote,
  PencilLine,
  Underline as LucideUnderline,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type FloatingCommentComposerProps = {
  category: string;
  roomId: string;
};

const draftRetentionMs = 3 * 24 * 60 * 60 * 1000;

export function FloatingCommentComposer({
  category,
  roomId,
}: FloatingCommentComposerProps) {
  const promptPhrases = useMemo(() => {
    return buildPromptPhrases(category);
  }, [category]);
  const draftStorageKey = useMemo(() => {
    return `subvote:room-draft:${roomId}`;
  }, [roomId]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [toolbarState, setToolbarState] = useState(getEmptyToolbarState);
  const hasHydratedDraftRef = useRef(false);
  const saveDraftTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isExpanded) {
      return;
    }

    const timer = window.setInterval(() => {
      setPhraseIndex((current) => {
        return (current + 1) % promptPhrases.length;
      });
    }, 3200);

    return () => {
      window.clearInterval(timer);
    };
  }, [isExpanded, promptPhrases.length]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder:
          "Write the signal, edge case, or decision detail that should enter the room.",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "composer-editor min-h-40 px-4 py-4 text-[0.98rem] leading-7 text-neutral-700 outline-none",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      setEditorText(nextEditor.getText().trim());
    },
  });

  useEffect(() => {
    return () => {
      if (saveDraftTimeoutRef.current) {
        window.clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (saveDraftTimeoutRef.current) {
      window.clearTimeout(saveDraftTimeoutRef.current);
    }

    hasHydratedDraftRef.current = false;

    const savedDraft = window.localStorage.getItem(draftStorageKey);

    if (!savedDraft) {
      editor.commands.clearContent();
      setEditorText("");
      hasHydratedDraftRef.current = true;
      return;
    }

    try {
      const parsedDraft = JSON.parse(savedDraft) as {
        content?: Record<string, unknown>;
        updatedAt?: number;
      };

      if (
        typeof parsedDraft.updatedAt !== "number" ||
        Date.now() - parsedDraft.updatedAt > draftRetentionMs
      ) {
        window.localStorage.removeItem(draftStorageKey);
        editor.commands.clearContent();
        setEditorText("");
        hasHydratedDraftRef.current = true;
        return;
      }

      if (parsedDraft.content) {
        editor.commands.setContent(parsedDraft.content, {
          emitUpdate: false,
        });
        setEditorText(editor.getText().trim());
      } else {
        editor.commands.clearContent();
        setEditorText("");
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
      editor.commands.clearContent();
      setEditorText("");
    }

    hasHydratedDraftRef.current = true;
  }, [draftStorageKey, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const persistDraft = () => {
      if (!hasHydratedDraftRef.current) {
        return;
      }

      if (saveDraftTimeoutRef.current) {
        window.clearTimeout(saveDraftTimeoutRef.current);
      }

      saveDraftTimeoutRef.current = window.setTimeout(() => {
        const text = editor.getText().trim();

        if (!text) {
          window.localStorage.removeItem(draftStorageKey);
          return;
        }

        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            content: editor.getJSON(),
            updatedAt: Date.now(),
          }),
        );
      }, 280);
    };

    editor.on("update", persistDraft);

    return () => {
      if (saveDraftTimeoutRef.current) {
        window.clearTimeout(saveDraftTimeoutRef.current);
      }
      editor.off("update", persistDraft);
    };
  }, [draftStorageKey, editor]);

  useEffect(() => {
    if (!editor) {
      setToolbarState(getEmptyToolbarState());
      return;
    }

    const syncToolbarState = () => {
      setToolbarState({
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isUnderline: editor.isActive("underline"),
        isBulletList: editor.isActive("bulletList"),
        isBlockquote: editor.isActive("blockquote"),
        isLink: editor.isActive("link"),
      });
    };

    syncToolbarState();
    editor.on("selectionUpdate", syncToolbarState);
    editor.on("transaction", syncToolbarState);
    editor.on("focus", syncToolbarState);
    editor.on("blur", syncToolbarState);

    return () => {
      editor.off("selectionUpdate", syncToolbarState);
      editor.off("transaction", syncToolbarState);
      editor.off("focus", syncToolbarState);
      editor.off("blur", syncToolbarState);
    };
  }, [editor]);

  useEffect(() => {
    if (!isExpanded || !editor) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      editor.commands.focus("end");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [editor, isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded((current) => !current);
  };

  const handleAddLink = () => {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previousUrl ?? "https://");

    if (!href) {
      if (previousUrl) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      }
      return;
    }

    if (editor.state.selection.empty) {
      const linkText = window.prompt("Link text", href) ?? href;

      if (!linkText) {
        return;
      }

      const insertFrom = editor.state.selection.from;

      editor
        .chain()
        .focus()
        .insertContent(linkText)
        .setTextSelection({ from: insertFrom, to: insertFrom + linkText.length })
        .setLink({ href })
        .run();

      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const handleToggleList = () => {
    if (!editor) {
      return;
    }

    const selectionEmpty = editor.state.selection.empty;
    const hasText = editor.getText().trim().length > 0;
    const wasActive = editor.isActive("bulletList");

    if (!wasActive && selectionEmpty && !hasText) {
      editor
        .chain()
        .focus()
        .clearContent()
        .insertContent({
          content: [
            {
              content: [
                {
                  content: [
                    {
                      text: "List item",
                      type: "text",
                    },
                  ],
                  type: "paragraph",
                },
              ],
              type: "listItem",
            },
          ],
          type: "bulletList",
        })
        .run();
      return;
    }

    editor.chain().focus().toggleBulletList().run();
  };

  const handleToggleQuote = () => {
    if (!editor) {
      return;
    }

    const selectionEmpty = editor.state.selection.empty;
    const hasText = editor.getText().trim().length > 0;
    const wasActive = editor.isActive("blockquote");

    if (!wasActive && selectionEmpty && !hasText) {
      editor
        .chain()
        .focus()
        .clearContent()
        .insertContent({
          content: [
            {
              content: [
                {
                  text: "Quoted note.",
                  type: "text",
                },
              ],
              type: "paragraph",
            },
          ],
          type: "blockquote",
        })
        .run();
      return;
    }

    editor.chain().focus().toggleBlockquote().run();
  };

  return (
    <section className="relative mx-auto w-full max-w-[32rem] px-2">
      <div className="pointer-events-none absolute inset-x-6 -top-8 bottom-0">
        <div className="composer-light composer-light-blue absolute left-[10%] top-[10%] h-24 w-24 rounded-full blur-3xl" />
        <div className="composer-light composer-light-violet absolute right-[12%] top-[4%] h-24 w-28 rounded-full blur-3xl" />
        <div className="composer-light composer-light-blue-soft absolute bottom-[8%] left-[44%] h-16 w-28 rounded-full blur-3xl" />
        <div className="composer-sweep absolute inset-x-[18%] top-[18%] h-10 rounded-full blur-2xl" />
      </div>

      <div className="relative overflow-hidden rounded-[1.7rem] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(250,247,241,0.66))] shadow-[0_24px_60px_rgba(50,58,92,0.08),0_10px_24px_rgba(15,17,17,0.05),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_44%,rgba(113,131,255,0.06)_72%,rgba(165,117,255,0.08)_100%)]" />
        <div className="composer-surface-glow pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(111,127,255,0.36),transparent)]" />
        <div className="pointer-events-none absolute left-4 top-4 h-4 w-4 rounded-tl-[1rem] border-l border-t border-neutral-900/10" />
        <div className="pointer-events-none absolute right-4 top-4 h-4 w-4 rounded-tr-[1rem] border-r border-t border-neutral-900/10" />

        <div className="relative flex flex-col">
          <div className="flex min-h-[5.5rem] items-center gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <h2
                key={promptPhrases[phraseIndex]}
                className={`composer-prompt text-[1rem] font-semibold tracking-[-0.04em] text-neutral-950 sm:text-[1.06rem] ${
                  isExpanded ? "" : "truncate"
                }`}
              >
                {promptPhrases[phraseIndex]}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={isExpanded ? "Close comment composer" : "Open comment composer"}
                aria-expanded={isExpanded}
                onClick={toggleExpanded}
                className={`inline-flex size-12 items-center justify-center rounded-full border border-[rgba(107,122,255,0.26)] bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(236,239,255,0.76))] text-[rgba(79,95,215,0.92)] shadow-[0_16px_30px_rgba(87,103,208,0.14),inset_0_1px_0_rgba(255,255,255,0.92)] transition-[box-shadow,background-color] duration-300 ${
                  isExpanded
                    ? "shadow-[0_18px_36px_rgba(87,103,208,0.2),inset_0_1px_0_rgba(255,255,255,0.94)]"
                    : ""
                }`}
              >
                <PencilLine size={18} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
                <div className="rounded-[1.45rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(250,247,244,0.74))] shadow-[0_14px_34px_rgba(29,34,54,0.05),inset_0_1px_0_rgba(255,255,255,0.84)]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-3 py-3 sm:px-4">
                    <ToolbarButton
                      label="Bold"
                      icon={<Bold size={14} strokeWidth={2} />}
                      isActive={toolbarState.isBold}
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                    />
                    <ToolbarButton
                      label="Italic"
                      icon={<Italic size={14} strokeWidth={2} />}
                      isActive={toolbarState.isItalic}
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                    />
                    <ToolbarButton
                      label="Underline"
                      icon={<LucideUnderline size={14} strokeWidth={2} />}
                      isActive={toolbarState.isUnderline}
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                    />
                    <ToolbarButton
                      label="List"
                      icon={<List size={14} strokeWidth={2} />}
                      isActive={toolbarState.isBulletList}
                      onClick={handleToggleList}
                    />
                    <ToolbarButton
                      label="Quote"
                      icon={<MessageSquareQuote size={14} strokeWidth={2} />}
                      isActive={toolbarState.isBlockquote}
                      onClick={handleToggleQuote}
                    />
                    <ToolbarButton
                      label="Link"
                      icon={<Link2 size={14} strokeWidth={2} />}
                      isActive={toolbarState.isLink}
                      onClick={handleAddLink}
                    />
                  </div>

                  <EditorContent editor={editor} />

                  <div className="flex items-center justify-between gap-4 border-t border-black/5 px-3 py-3 sm:px-4">
                    <span className="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      {editorText ? `${editorText.length} chars` : "Rich text enabled"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center rounded-full border border-white/65 bg-[rgba(255,255,255,0.56)] px-4 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
                      >
                        Speech Cost Meter
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center rounded-full bg-[linear-gradient(135deg,rgba(84,103,255,0.92),rgba(139,96,255,0.88))] px-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-white shadow-[0_16px_34px_rgba(90,104,210,0.22)]"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .composer-light {
          animation-duration: 14s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          opacity: 0.62;
          will-change: transform, opacity;
        }

        .composer-sweep {
          animation: composerSweep 12s ease-in-out infinite;
          background: linear-gradient(
            90deg,
            rgba(96, 120, 255, 0),
            rgba(96, 120, 255, 0.16) 35%,
            rgba(177, 118, 255, 0.24) 50%,
            rgba(96, 120, 255, 0.16) 65%,
            rgba(96, 120, 255, 0)
          );
          opacity: 0.56;
          will-change: transform, opacity;
        }

        .composer-surface-glow {
          animation: composerSurfaceGlow 9s ease-in-out infinite;
          background:
            radial-gradient(circle at 18% 20%, rgba(98, 126, 255, 0.12), transparent 26%),
            radial-gradient(circle at 82% 16%, rgba(164, 112, 255, 0.12), transparent 30%),
            radial-gradient(circle at 55% 88%, rgba(103, 179, 255, 0.08), transparent 28%);
        }

        .composer-prompt {
          animation: composerPromptIn 420ms ease-out;
        }

        .composer-editor p.is-editor-empty:first-child::before {
          color: rgba(115, 115, 115, 0.9);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .composer-editor blockquote {
          background: linear-gradient(
            180deg,
            rgba(99, 115, 255, 0.06),
            rgba(255, 255, 255, 0.72)
          );
          border-left: 2px solid rgba(99, 115, 255, 0.32);
          border-radius: 0.95rem;
          color: rgba(82, 82, 91, 1);
          margin: 0.35rem 0;
          padding: 0.8rem 1rem;
        }

        .composer-editor blockquote p {
          margin: 0;
          min-height: 1.75rem;
        }

        .composer-editor ul {
          margin: 0.35rem 0;
          padding-left: 0;
        }

        .composer-editor li {
          list-style: none;
          margin: 0.2rem 0;
          padding-left: 1.4rem;
          position: relative;
        }

        .composer-editor li::before {
          background: rgba(99, 115, 255, 0.92);
          border-radius: 9999px;
          content: "";
          height: 0.42rem;
          left: 0.3rem;
          position: absolute;
          top: 0.72rem;
          width: 0.42rem;
        }

        .composer-editor li p {
          margin: 0;
        }

        .composer-editor a {
          color: rgba(79, 95, 215, 0.95);
          font-weight: 500;
          text-decoration: underline;
          text-decoration-color: rgba(99, 115, 255, 0.58);
          text-underline-offset: 0.18em;
        }

        .composer-light-blue {
          animation-name: composerDriftBlue;
          background: radial-gradient(circle, rgba(93, 124, 255, 0.28) 0%, rgba(93, 124, 255, 0.08) 45%, rgba(93, 124, 255, 0) 72%);
        }

        .composer-light-violet {
          animation-duration: 17s;
          animation-name: composerDriftViolet;
          background: radial-gradient(circle, rgba(151, 108, 255, 0.24) 0%, rgba(151, 108, 255, 0.08) 42%, rgba(151, 108, 255, 0) 72%);
        }

        .composer-light-blue-soft {
          animation-duration: 19s;
          animation-name: composerDriftBlueSoft;
          background: radial-gradient(circle, rgba(109, 178, 255, 0.16) 0%, rgba(109, 178, 255, 0.05) 48%, rgba(109, 178, 255, 0) 76%);
        }

        @keyframes composerDriftBlue {
          0%,
          100% {
            opacity: 0.4;
            transform: translate3d(-8px, -4px, 0) scale(0.9);
          }
          50% {
            opacity: 0.86;
            transform: translate3d(26px, 18px, 0) scale(1.18);
          }
        }

        @keyframes composerDriftViolet {
          0%,
          100% {
            opacity: 0.34;
            transform: translate3d(10px, -6px, 0) scale(0.96);
          }
          50% {
            opacity: 0.76;
            transform: translate3d(-24px, 24px, 0) scale(1.16);
          }
        }

        @keyframes composerDriftBlueSoft {
          0%,
          100% {
            opacity: 0.22;
            transform: translate3d(-4px, 2px, 0) scale(0.9);
          }
          50% {
            opacity: 0.58;
            transform: translate3d(18px, -14px, 0) scale(1.12);
          }
        }

        @keyframes composerSweep {
          0%,
          100% {
            opacity: 0.16;
            transform: translate3d(-24px, 0, 0) scaleX(0.9);
          }
          50% {
            opacity: 0.68;
            transform: translate3d(24px, 0, 0) scaleX(1.08);
          }
        }

        @keyframes composerSurfaceGlow {
          0%,
          100% {
            opacity: 0.42;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.03);
          }
        }

        @keyframes composerPromptIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 6px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </section>
  );
}

function buildPromptPhrases(category: string) {
  return [
    "Name the edge case before it repeats.",
    "Drop the signal that sharpens this thread.",
    `Add the missing ${category.toLowerCase()} detail.`,
    "Say what the room is still overlooking.",
    "Leave the fact that changes the decision.",
    "Record the failure mode before it spreads.",
  ];
}

function getEmptyToolbarState() {
  return {
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isBulletList: false,
    isBlockquote: false,
    isLink: false,
  };
}

function ToolbarButton({
  label,
  icon,
  isActive = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 text-[0.66rem] font-medium uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] transition-[background-color,border-color,color,box-shadow] duration-200 ${
        isActive
          ? "border-[rgba(103,120,255,0.3)] bg-[rgba(236,239,255,0.96)] text-[rgba(79,95,215,0.96)] shadow-[0_10px_24px_rgba(100,115,220,0.08),inset_0_1px_0_rgba(255,255,255,0.82)]"
          : "border-white/70 bg-[rgba(255,255,255,0.55)] text-neutral-600 hover:bg-[rgba(255,255,255,0.82)]"
      }`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
    </button>
  );
}
