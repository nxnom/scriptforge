import { Alert, Dialog, Spinner, toast } from "@geckoui/geckoui";
import { useRead, useWrite } from "../api";
import type { ConfigurationUpdate } from "./ToolConfigurationForm";
import { ToolConfigurationForm } from "./ToolConfigurationForm";

export function openInstalledConfiguration(toolId: string) {
  return openConfiguration((dismiss, settle) => (
    <InstalledConfigurationPanel
      toolId={toolId}
      onSaved={() => settle(true, dismiss)}
      onCancel={() => settle(false, dismiss)}
    />
  ));
}

export function openCandidateConfiguration(sessionId: string, revision: string) {
  return openConfiguration((dismiss, settle) => (
    <CandidateConfiguration
      sessionId={sessionId}
      revision={revision}
      onSaved={() => settle(true, dismiss)}
      onCancel={() => settle(false, dismiss)}
    />
  ));
}

export function InstalledConfigurationPanel({
  toolId,
  onSaved,
  onCancel,
  showHeading,
}: {
  toolId: string;
  onSaved: () => void;
  onCancel: () => void;
  showHeading?: boolean;
}) {
  const status = useRead((api) => api("tools/:toolId/configuration").GET({ params: { toolId } }), { staleTime: 0 });
  const update = useWrite((api) => api("tools/:toolId/configuration").PUT());
  const save = async (body: ConfigurationUpdate) => {
    const response = await update.trigger({ params: { toolId }, body });
    if (!response.data?.ok) {
      toast.error(errorMessage(response.error));
      return;
    }
    onSaved();
  };
  return (
    <ConfigurationContent
      status={status}
      saving={update.loading}
      save={save}
      cancel={onCancel}
      showHeading={showHeading}
    />
  );
}

function CandidateConfiguration({
  sessionId,
  revision,
  onSaved,
  onCancel,
}: {
  sessionId: string;
  revision: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const status = useRead(
    (api) =>
      api("forge/sessions/:sessionId/candidate/configuration").GET({
        params: { sessionId },
        query: { revision },
      }),
    { staleTime: 0 },
  );
  const update = useWrite((api) => api("forge/sessions/:sessionId/candidate/configuration").PUT());
  const save = async ({ values, clearSecrets }: ConfigurationUpdate) => {
    const response = await update.trigger({ params: { sessionId }, body: { revision, values, clearSecrets } });
    if (!response.data?.ok) {
      toast.error(errorMessage(response.error));
      return;
    }
    onSaved();
  };
  return <ConfigurationContent status={status} saving={update.loading} save={save} cancel={onCancel} />;
}

function ConfigurationContent({
  status,
  saving,
  save,
  cancel,
  showHeading,
}: {
  status: { loading: boolean; error?: unknown; data?: { ok: boolean; fields?: unknown } };
  saving: boolean;
  save: (update: ConfigurationUpdate) => Promise<void>;
  cancel: () => void;
  showHeading?: boolean;
}) {
  if (status.loading)
    return (
      <div className="grid min-h-40 place-items-center">
        <Spinner />
      </div>
    );
  if (status.error || !status.data?.ok || !Array.isArray(status.data.fields)) {
    return <Alert variant="error" title="Configuration unavailable" description={errorMessage(status.error)} />;
  }
  return (
    <ToolConfigurationForm
      fields={status.data.fields}
      saving={saving}
      onSave={save}
      onCancel={cancel}
      showHeading={showHeading}
    />
  );
}

function openConfiguration(
  content: (dismiss: () => void, settle: (saved: boolean, dismiss: () => void) => void) => React.ReactNode,
) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    Dialog.show({
      className: "w-[min(520px,calc(100vw-32px))] max-w-none bg-[#1d1d1d] p-5",
      dismissOnEsc: false,
      dismissOnOutsideClick: false,
      content: ({ dismiss }) =>
        content(dismiss, (saved, close) => {
          if (settled) return;
          settled = true;
          close();
          resolve(saved);
        }),
    });
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The tool configuration could not be loaded.";
}
