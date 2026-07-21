import { Button, LoadingButton, RHFCheckbox, RHFError, RHFInput, RHFRadio, RHFTextarea } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import type { ForgePanelDocument } from "../../server/forge/types";

const baseFeedbackSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  note: z.string().max(8_000),
  decision: z.enum(["approved", "rejected"]).optional(),
});

type FeedbackValues = z.infer<typeof baseFeedbackSchema>;

export function PanelFeedbackForm({
  panel,
  onFeedback,
  children,
}: {
  panel: ForgePanelDocument;
  onFeedback: (text: string) => Promise<void>;
  children: ReactNode;
}) {
  const questions = panel.blocks.filter((block) => block.type === "question");
  const approval = panel.blocks.find((block) => block.type === "approval");
  const submitted = useRef(false);
  const form = useForm<FeedbackValues>({
    resolver: zodResolver(createFeedbackSchema(panel)),
    defaultValues: {
      answers: Object.fromEntries(
        questions.map((question) => [
          question.input.name,
          question.input.defaultValue ?? (question.input.kind === "multi_choice" ? [] : ""),
        ]),
      ),
      note: "",
    },
  });
  const submit = form.handleSubmit(async (data) => {
    if (submitted.current) return;
    submitted.current = true;
    await onFeedback(composeFeedback(panel, data));
  });
  const decide = (decision: "approved" | "rejected") => {
    form.setValue("decision", decision, { shouldValidate: true });
    void submit();
  };

  return (
    <FormProvider {...form}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {children}
          {questions.map((question) => (
            <fieldset className="m-0 grid gap-2 border-0 p-0" key={question.id}>
              <legend className="mb-1 p-0 font-medium text-[#dedede] text-sm">
                {question.prompt}
                {question.input.required && <span className="ml-1 text-[#d88980]">*</span>}
              </legend>
              {question.input.kind === "text" &&
                (question.input.multiline ? (
                  <RHFTextarea
                    name={`answers.${question.input.name}`}
                    placeholder={question.input.placeholder}
                    rows={4}
                  />
                ) : (
                  <RHFInput name={`answers.${question.input.name}`} placeholder={question.input.placeholder} />
                ))}
              {question.input.kind === "single_choice" &&
                question.input.options.map((option) => (
                  <RHFRadio
                    key={option.value}
                    name={`answers.${question.input.name}`}
                    value={option.value}
                    label={<OptionLabel label={option.label} description={option.description} />}
                  />
                ))}
              {question.input.kind === "multi_choice" &&
                question.input.options.map((option) => (
                  <RHFCheckbox
                    key={option.value}
                    name={`answers.${question.input.name}`}
                    value={option.value}
                    label={<OptionLabel label={option.label} description={option.description} />}
                  />
                ))}
              <RHFError name={`answers.${question.input.name}`} />
            </fieldset>
          ))}
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-[#333] border-t bg-[#1d1d1d] p-4">
          {approval && (
            <p className="m-0 text-[10px] leading-4 text-[#888]">
              Approval lets Codex build and check this tool locally. Machine changes follow the permission mode you
              chose when starting Forge, and nothing is saved to your library.
            </p>
          )}
          <RHFTextarea name="note" placeholder="Add feedback (required when requesting changes)" rows={2} />
          <RHFError name="note" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outlined" onClick={() => decide("rejected")}>
              {approval?.rejectLabel ?? "Request changes"}
            </Button>
            <LoadingButton
              type="button"
              size="sm"
              loading={form.formState.isSubmitting}
              onClick={() => decide("approved")}
            >
              {approval?.approveLabel ?? "Approve, build & check"}
            </LoadingButton>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

function createFeedbackSchema(panel: ForgePanelDocument) {
  return baseFeedbackSchema.superRefine((values, context) => {
    if (values.decision === "rejected" && !values.note.trim()) {
      context.addIssue({ code: "custom", path: ["note"], message: "Tell Codex what you want changed." });
    }
    for (const block of panel.blocks) {
      if (values.decision === "rejected" || block.type !== "question" || !block.input.required) continue;
      const answer = values.answers[block.input.name];
      if ((Array.isArray(answer) && answer.length > 0) || (typeof answer === "string" && answer.trim())) continue;
      context.addIssue({
        code: "custom",
        path: ["answers", block.input.name],
        message: "This answer is required.",
      });
    }
  });
}

function OptionLabel({ label, description }: { label: string; description?: string }) {
  return (
    <span className="grid gap-0.5 text-left">
      <span className="text-xs">{label}</span>
      {description && <span className="text-[10px] leading-4 text-[#8f8f8f]">{description}</span>}
    </span>
  );
}

function composeFeedback(panel: ForgePanelDocument, values: FeedbackValues) {
  const sections = [`## ScriptForge response: ${panel.title}`];
  for (const block of panel.blocks) {
    if (block.type !== "question") continue;
    const answer = values.answers[block.input.name];
    const formatted = Array.isArray(answer) ? answer.join(", ") : answer;
    sections.push(`**${block.prompt}**\n${formatted || "(not answered)"}`);
  }
  if (!values.decision) sections.push("**Approved. Build and run the standalone check now.**");
  if (values.decision)
    sections.push(
      values.decision === "approved"
        ? "**Approved. Build and run the standalone check now.**"
        : "**Not approved. Revise the proposal.**",
    );
  if (values.note.trim()) sections.push(values.note.trim());
  return sections.join("\n\n");
}
