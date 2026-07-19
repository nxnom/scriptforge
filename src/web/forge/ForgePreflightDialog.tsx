import {
  Alert,
  Button,
  Label,
  LoadingButton,
  RHFCheckbox,
  RHFError,
  RHFSelect,
  SelectOption,
  Spinner,
} from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Copy, Hammer } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useRead } from "../api";
import {
  effortOptions,
  type ForgePreferences,
  forgePreferencesSchema,
  loadForgePreferences,
  modelOptions,
  saveForgePreferences,
} from "./preferences";

type Props = {
  dismiss: () => void;
  onContinue: (preferences: ForgePreferences) => Promise<void>;
};

export function ForgePreflightDialog({ dismiss, onContinue }: Props) {
  const [startError, setStartError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const status = useRead((api) => api("codex/status").GET(), { staleTime: 5_000 });
  const methods = useForm<ForgePreferences>({
    resolver: zodResolver(forgePreferencesSchema),
    defaultValues: loadForgePreferences(),
  });
  const ready = Boolean(status.data?.installed && status.data.authenticated);

  const submit = methods.handleSubmit(async (preferences) => {
    setStartError(undefined);
    setStarting(true);
    try {
      await onContinue(preferences);
      saveForgePreferences(preferences);
      dismiss();
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "The Forge terminal could not start.");
      setStarting(false);
    }
  });

  return (
    <FormProvider {...methods}>
      <form className="grid gap-5" onSubmit={submit}>
        <header className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#303030]">
            <Hammer size={19} />
          </span>
          <div>
            <h2 className="m-0 font-[Geist_Variable] text-lg">Start a new forge</h2>
            <p className="mt-1 mb-0 text-xs leading-5 text-[#929292]">
              Choose the Codex model and reasoning effort for this tool-building session.
            </p>
          </div>
        </header>

        <CodexReadiness status={status} />
        {startError && <Alert variant="error" condensed title="Forge could not start" description={startError} />}

        <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <div className="grid gap-1.5">
            <Label required>Model</Label>
            <RHFSelect name="model" disabled={!ready}>
              {modelOptions.map((option) => (
                <SelectOption key={option.value} value={option.value} label={option.label} />
              ))}
            </RHFSelect>
            <RHFError name="model" />
          </div>
          <div className="grid gap-1.5">
            <Label required>Reasoning effort</Label>
            <RHFSelect name="effort" disabled={!ready}>
              {effortOptions.map((effort) => (
                <SelectOption key={effort} value={effort} label={effort.charAt(0).toUpperCase() + effort.slice(1)} />
              ))}
            </RHFSelect>
            <RHFError name="effort" />
          </div>
        </div>

        <div className="grid gap-1.5 rounded-xl border border-[#5a4324] bg-[#2c251b] p-3">
          <RHFCheckbox
            name="dangerouslyBypassApprovalsAndSandbox"
            single
            value={true}
            uncheckedValue={false}
            disabled={!ready}
            label="Skip Codex permission prompts"
            labelClassName="text-xs font-medium text-[#e6c58c]"
          />
          <p className="m-0 pl-6 text-[11px] leading-4 text-[#b7a486]">
            Runs Codex with <code>--dangerously-bypass-approvals-and-sandbox</code>. Codex can act without approval
            prompts in the staging workspace. Leave this off unless you trust the session.
          </p>
          <RHFError name="dangerouslyBypassApprovalsAndSandbox" />
        </div>

        <footer className="flex justify-end gap-2 border-[#353535] border-t pt-4">
          <Button type="button" variant="ghost" onClick={dismiss}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            disabled={!ready}
            loading={status.loading || starting}
            loadingText={starting ? "Starting Codex…" : "Checking Codex…"}
          >
            Continue to Forge
          </LoadingButton>
        </footer>
      </form>
    </FormProvider>
  );
}

function CodexReadiness({ status }: { status: ReturnType<typeof useCodexStatus> }) {
  if (status.loading)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#363636] bg-[#202020] p-3 text-xs text-[#aaa]">
        <Spinner /> Checking the local Codex CLI…
      </div>
    );
  if (status.error)
    return <StatusProblem title="Could not check Codex" command="codex doctor" retry={status.trigger} />;
  if (!status.data?.installed)
    return (
      <StatusProblem
        title="Codex CLI is not installed"
        command="npm install --global @openai/codex"
        retry={status.trigger}
      />
    );
  if (!status.data.authenticated)
    return <StatusProblem title="Codex needs authentication" command="codex login" retry={status.trigger} />;
  return (
    <Alert
      variant="success"
      condensed
      icon={<CheckCircle2 size={16} />}
      title="Codex is ready"
      description={`${status.data.version ?? "Installed"} · authenticated with ${status.data.authMethod ?? "Codex"}`}
    />
  );
}

function useCodexStatus() {
  return useRead((api) => api("codex/status").GET(), { staleTime: 5_000 });
}

function StatusProblem({ title, command, retry }: { title: string; command: string; retry: () => unknown }) {
  return (
    <div className="grid gap-2 rounded-xl border border-[#5a4324] bg-[#2c251b] p-3">
      <Alert
        variant="warning"
        condensed
        title={title}
        description="Run this yourself, then retry. ScriptForge never installs or signs in automatically."
      />
      <div className="flex items-center gap-2 rounded-lg bg-[#191919] px-3 py-2 font-mono text-[11px] text-[#ddd]">
        <code className="min-w-0 flex-1 overflow-hidden text-ellipsis">{command}</code>
        <Button
          type="button"
          size="xs"
          variant="icon"
          aria-label={`Copy ${command}`}
          onClick={() => void navigator.clipboard.writeText(command).catch(() => undefined)}
        >
          <Copy size={13} />
        </Button>
      </div>
      <Button className="justify-self-start" type="button" size="xs" variant="outlined" onClick={() => retry()}>
        Retry
      </Button>
    </div>
  );
}
