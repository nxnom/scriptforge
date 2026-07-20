import { Button, LoadingButton } from "@geckoui/geckoui";
import { Clock3, RotateCcw, Trash2 } from "lucide-react";

export type ForgeDraft = {
  sessionId: string;
  name: string;
  status: "stopped" | "interrupted";
  scope: "create" | "update";
  toolId: string | null;
  updatedAt: number;
  resumable: boolean;
};

type Props = {
  drafts: ForgeDraft[];
  loading: boolean;
  resumingId?: string;
  discardingId?: string;
  onResume: (draft: ForgeDraft) => void;
  onDiscard: (draft: ForgeDraft) => void;
};

export function ForgeDraftList({ drafts, loading, resumingId, discardingId, onResume, onDiscard }: Props) {
  if (!loading && drafts.length === 0) return null;
  return (
    <section className="grid gap-2 text-left" aria-labelledby="saved-forges-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="saved-forges-title" className="m-0 font-[Geist_Variable] text-sm font-semibold">
            Continue working
          </h2>
          <p className="mt-1 mb-0 text-[11px] text-[#8f8f8f]">Stopped and interrupted sessions remain on this Mac.</p>
        </div>
        {loading && <span className="text-[10px] text-[#777]">Checking saved sessions…</span>}
      </div>
      {drafts.map((draft) => (
        <article
          key={draft.sessionId}
          className="flex items-center gap-3 rounded-xl border border-[#383838] bg-[#202020] p-3 max-[560px]:items-start max-[560px]:flex-col"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#303030] text-[#aeb6ff]">
            <Clock3 size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 truncate text-xs font-semibold text-[#e8e8e8]">{draft.name}</h3>
            <p className="mt-1 mb-0 text-[10px] text-[#8f8f8f]">
              {draft.status === "interrupted" ? "Interrupted" : "Stopped"} · {formatUpdatedAt(draft.updatedAt)}
              {draft.scope === "update" ? " · Tool update" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 max-[560px]:w-full max-[560px]:justify-end">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label={`Discard ${draft.name}`}
              disabled={Boolean(resumingId || discardingId)}
              onClick={() => onDiscard(draft)}
            >
              <Trash2 size={12} /> Discard
            </Button>
            <LoadingButton
              type="button"
              size="xs"
              loading={resumingId === draft.sessionId}
              disabled={!draft.resumable || Boolean(discardingId)}
              title={draft.resumable ? undefined : "The matching Codex conversation could not be found"}
              onClick={() => onResume(draft)}
            >
              <RotateCcw size={12} /> Resume
            </LoadingButton>
          </div>
        </article>
      ))}
    </section>
  );
}

function formatUpdatedAt(value: number) {
  const elapsed = Date.now() - value;
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
