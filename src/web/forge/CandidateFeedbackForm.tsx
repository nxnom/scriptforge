import { Button, LoadingButton, RHFError, RHFTextarea } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

const candidateFeedbackSchema = z
  .object({
    intent: z.enum(["approve", "revise"]),
    note: z.string().max(8_000),
  })
  .superRefine((values, context) => {
    if (values.intent === "revise" && !values.note.trim()) {
      context.addIssue({ code: "custom", path: ["note"], message: "Describe what Codex should change." });
    }
  });

type CandidateFeedback = z.infer<typeof candidateFeedbackSchema>;

export function CandidateFeedbackForm({
  approved,
  onFeedback,
}: {
  approved: boolean;
  onFeedback: (values: CandidateFeedback) => Promise<void>;
}) {
  const form = useForm<CandidateFeedback>({
    resolver: zodResolver(candidateFeedbackSchema),
    defaultValues: { intent: "revise", note: "" },
  });
  const submit = (intent: CandidateFeedback["intent"]) => {
    form.setValue("intent", intent, { shouldValidate: true });
    void form.handleSubmit(onFeedback)();
  };

  return (
    <FormProvider {...form}>
      <form className="grid gap-2" onSubmit={(event) => event.preventDefault()}>
        <RHFTextarea name="note" placeholder="Describe changes for Codex" rows={2} disabled={approved} />
        <RHFError name="note" />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outlined" disabled={approved} onClick={() => submit("revise")}>
            Request changes
          </Button>
          <LoadingButton
            type="button"
            size="sm"
            disabled={approved}
            loading={form.formState.isSubmitting}
            onClick={() => submit("approve")}
          >
            {approved ? "Candidate approved" : "Approve candidate"}
          </LoadingButton>
        </div>
      </form>
    </FormProvider>
  );
}
