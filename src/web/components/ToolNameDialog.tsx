import { Alert, Button, Dialog, Label, LoadingButton, RHFError, RHFInput } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter a tool title.").max(80, "Keep the title under 80 characters."),
});
type NameValues = z.infer<typeof nameSchema>;

type ToolNameDialogOptions = {
  heading: string;
  description: string;
  label: string;
  confirmLabel: string;
  loadingLabel: string;
  initialName: string;
  submit: (name: string) => Promise<void>;
};

export function openToolNameDialog(options: ToolNameDialogOptions) {
  Dialog.show({
    className: "w-[min(460px,calc(100vw-24px))] max-w-none border border-[#393939] bg-[#242424] p-5",
    content: ({ dismiss }) => <ToolNameDialog {...options} dismiss={dismiss} />,
  });
}

function ToolNameDialog({ dismiss, ...options }: ToolNameDialogOptions & { dismiss: () => void }) {
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const form = useForm<NameValues>({ resolver: zodResolver(nameSchema), defaultValues: { name: options.initialName } });
  const submit = form.handleSubmit(async ({ name }) => {
    setError(undefined);
    setSaving(true);
    try {
      await options.submit(name.trim());
      dismiss();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That title could not be saved.");
      setSaving(false);
    }
  });

  return (
    <FormProvider {...form}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <h2 className="m-0 font-[Geist_Variable] text-lg">{options.heading}</h2>
          <p className="mt-1.5 mb-0 text-xs text-[#929292]">{options.description}</p>
        </div>
        {error && <Alert variant="error" title="That did not work" description={error} condensed />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tool-name" required>
            {options.label}
          </Label>
          <RHFInput id="tool-name" name="name" autoComplete="off" autoFocus placeholder="Tool title" />
          <RHFError name="name" />
        </div>
        <div className="flex justify-end gap-2 border-[#333] border-t pt-3">
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={dismiss}>
            Cancel
          </Button>
          <LoadingButton type="submit" size="sm" loading={saving} loadingText={options.loadingLabel}>
            {options.confirmLabel}
          </LoadingButton>
        </div>
      </form>
    </FormProvider>
  );
}
