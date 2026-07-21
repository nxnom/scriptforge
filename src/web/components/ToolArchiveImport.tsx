import { LoadingButton, RHFError, RHFFilePicker, toast } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { form as spooshForm } from "@spoosh/core";
import { FileArchive, PackageOpen } from "lucide-react";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { invalidate, useWrite } from "../api";

const importSchema = z.object({
  files: z.array(z.instanceof(File)),
});
type ImportForm = z.infer<typeof importSchema>;
type ImportProgress = { current: number; total: number; fileName: string };

export function ToolArchiveImport() {
  const importTool = useWrite((api) => api("tools/import").POST());
  const importingRef = useRef(false);
  const [progress, setProgress] = useState<ImportProgress>();
  const form = useForm<ImportForm>({
    resolver: zodResolver(importSchema),
    defaultValues: { files: [] },
  });
  const submit = form.handleSubmit(async ({ files }) => {
    await importFiles(files);
  });
  const importFiles = async (files: File[]) => {
    if (importingRef.current) return;
    if (files.length === 0) {
      form.clearErrors("files");
      return;
    }
    const parsed = importSchema.safeParse({ files });
    if (!parsed.success) {
      form.setError("files", { type: "validate", message: parsed.error.issues[0]?.message });
      return;
    }
    form.clearErrors("files");
    importingRef.current = true;
    const imported: Array<{ name: string; status: "ready" | "needs-install" | "needs-config" }> = [];
    try {
      for (const [index, file] of parsed.data.files.entries()) {
        setProgress({ current: index + 1, total: parsed.data.files.length, fileName: file.name });
        try {
          const response = await importTool.trigger({ body: spooshForm({ file }) });
          if (!response.data?.ok) throw response.error;
          imported.push(response.data.tool);
        } catch (error) {
          toast.error(`${file.name}: ${apiError(error)}`);
        }
      }
      if (imported.length > 0) {
        invalidate("tools");
        showImportSuccess(imported, parsed.data.files.length);
      }
    } finally {
      importingRef.current = false;
      setProgress(undefined);
      form.resetField("files");
    }
  };

  return (
    <FormProvider {...form}>
      <form className="grid gap-1" onSubmit={submit}>
        <RHFFilePicker
          name="files"
          accept=".forge,application/x-scriptforge-tool"
          onChange={(_, newFiles) => importFiles(newFiles)}
          render={({ dropzoneRef, dragging, loading, files, openFilePicker }) => (
            <div
              ref={dropzoneRef}
              data-testid="archive-dropzone"
              className={`relative flex min-h-24 items-center justify-between gap-5 overflow-hidden rounded-[18px] border px-6 py-5 transition-colors max-[620px]:items-start max-[620px]:px-4 max-[620px]:py-4 max-[520px]:flex-col ${dragging ? "border-[#a6b1ff] bg-[#6375ff]" : "border-[#6375ff] bg-[#5468ff]"}`}
            >
              <PackageOpen
                className="pointer-events-none absolute top-[-34px] right-28 rotate-[-14deg] text-white/10"
                size={150}
              />
              <div className="relative flex min-w-0 items-center gap-3 text-white">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12">
                  <FileArchive size={19} />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 truncate font-[Geist_Variable] text-xl font-semibold max-[620px]:text-lg">
                    {importTitle(files, dragging, progress)}
                  </h2>
                  <p className="mt-1 mb-0 text-[12px] text-[#e0e4ff] max-[620px]:line-clamp-2">
                    {importDescription(files, progress)}
                  </p>
                </div>
              </div>
              <LoadingButton
                className="relative shrink-0 border-white! bg-white! text-[#252945]! hover:bg-[#eef0ff]! max-[520px]:w-full"
                size="sm"
                type="button"
                loading={Boolean(progress) || importTool.loading || loading}
                loadingText={progress ? `Importing ${progress.current} of ${progress.total}…` : "Importing…"}
                disabled={Boolean(progress) || importTool.loading}
                onClick={() => openFilePicker({ multiple: true })}
              >
                Choose files
              </LoadingButton>
            </div>
          )}
        />
        <RHFError name="files" />
      </form>
    </FormProvider>
  );
}

function importTitle(files: File[], dragging: boolean, progress?: ImportProgress) {
  if (progress) return `Importing ${progress.current} of ${progress.total}`;
  if (files.length > 1) return `${files.length} tools selected`;
  if (files.length === 1) return files[0]?.name;
  return dragging ? "Drop your .forge files here" : "Add tools from .forge files";
}

function importDescription(files: File[], progress?: ImportProgress) {
  if (progress) return `${progress.fileName} · Validating and importing…`;
  if (files.length === 1) return `${formatBytes(files[0]?.size ?? 0)} · Waiting to import…`;
  if (files.length > 1) return `${formatBytes(files.reduce((total, file) => total + file.size, 0))} total`;
  return "Choose or drop one or more archives. ScriptForge validates each package and never runs it during import.";
}

function showImportSuccess(
  imported: Array<{ name: string; status: "ready" | "needs-install" | "needs-config" }>,
  total: number,
) {
  if (total === 1) {
    const tool = imported[0];
    if (!tool) return;
    toast.success(tool.status === "ready" ? `${tool.name} imported.` : `${tool.name} imported and needs setup.`);
    return;
  }
  const setupCount = imported.filter((tool) => tool.status !== "ready").length;
  toast.success(
    `${imported.length} of ${total} tools imported${setupCount > 0 ? `; ${setupCount} ${setupCount === 1 ? "needs" : "need"} setup` : ""}.`,
  );
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function apiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "That .forge file could not be imported.";
}
