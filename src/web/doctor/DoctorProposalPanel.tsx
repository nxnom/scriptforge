import { Button, LoadingButton, RHFTextarea, toast } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import type { DoctorProposal } from "../../server/doctor/types";
import { useWrite } from "../api";

const feedbackSchema = z.object({ feedback: z.string().max(8_000) });

export function DoctorProposalPanel({
  sessionId,
  proposal,
  onDismiss,
}: {
  sessionId: string;
  proposal: DoctorProposal;
  onDismiss: () => void;
}) {
  const approve = useWrite((api) => api("doctor/sessions/:sessionId/proposal/approve").POST());
  const reject = useWrite((api) => api("doctor/sessions/:sessionId/proposal/reject").POST());
  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { feedback: "" },
  });
  const approveCommands = async () => {
    const response = await approve.trigger({ params: { sessionId } });
    if (!response.data?.ok) return toast.error(apiError(response.error));
    onDismiss();
  };
  const requestChanges = form.handleSubmit(async ({ feedback }) => {
    const response = await reject.trigger({ params: { sessionId }, body: { feedback } });
    if (!response.data?.ok) return toast.error(apiError(response.error));
    onDismiss();
  });

  return (
    <aside className="mx-auto flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-2xl border border-[#3a3a3a] bg-[#202020] p-4">
      <header className="flex items-start gap-3 border-[#343434] border-b pb-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2d2d2d]">
          <ShieldCheck size={17} />
        </span>
        <div>
          <h2 className="m-0 font-[Geist_Variable] text-base">Review installation commands</h2>
          <p className="mt-1 mb-0 text-[11px] leading-4 text-[#929292]">
            Nothing runs until you approve this exact list.
          </p>
        </div>
      </header>
      <p className="text-xs leading-5 text-[#c6c6c6]">{proposal.summary}</p>
      <ol className="m-0 grid min-w-0 gap-3 p-0">
        {proposal.commands.map((item) => (
          <li
            className="min-w-0 list-none rounded-xl border border-[#353535] bg-[#181818] p-3"
            key={`${displayCommand(item.command, item.args)}-${item.explanation}`}
          >
            <code className="block w-full max-w-full overflow-x-auto whitespace-nowrap text-[11px] text-[#eee]">
              {displayCommand(item.command, item.args)}
            </code>
            <p className="mt-2 mb-0 text-[10px] leading-4 text-[#929292]">{item.explanation}</p>
          </li>
        ))}
      </ol>
      <FormProvider {...form}>
        <form className="mt-auto grid gap-3 pt-4" onSubmit={requestChanges}>
          <RHFTextarea name="feedback" rows={2} placeholder="Optional feedback for Codex Doctor" />
          <div className="flex justify-end gap-2">
            <LoadingButton type="submit" size="sm" variant="outlined" loading={reject.loading}>
              Request changes
            </LoadingButton>
            <Button type="button" size="sm" onClick={approveCommands} disabled={approve.loading}>
              Install
            </Button>
          </div>
        </form>
      </FormProvider>
    </aside>
  );
}

function displayCommand(command: string, args: string[]) {
  return [command, ...args]
    .map((part) => (/^[A-Za-z0-9_./:+,@=-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(" ");
}

function apiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The Doctor request failed.";
}
