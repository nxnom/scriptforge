import { LoadingButton, RHFError, RHFFilePicker, toast } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { form as spooshForm } from "@spoosh/core";
import { FileArchive, PackageOpen } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { invalidate, useWrite } from "../api";

const importSchema = z.object({ files: z.array(z.instanceof(File)).length(1, "Choose one .forge file.") });
type ImportForm = z.infer<typeof importSchema>;

export function ToolArchiveImport() {
  const navigate = useNavigate();
  const importTool = useWrite((api) => api("tools/import").POST());
  const form = useForm<ImportForm>({
    resolver: zodResolver(importSchema),
    defaultValues: { files: [] },
  });
  const submit = form.handleSubmit(async ({ files }) => {
    const file = files[0];
    if (!file) return;
    const response = await importTool.trigger({ body: spooshForm({ file }) });
    if (!response.data?.ok) return toast.error(apiError(response.error));
    invalidate("tools");
    toast.success(
      response.data.tool.status === "ready"
        ? `${response.data.tool.name} imported.`
        : `${response.data.tool.name} imported and needs a dependency.`,
    );
    navigate(`/tools/${response.data.tool.id}`);
  });

  return (
    <FormProvider {...form}>
      <form className="grid gap-1" onSubmit={submit}>
        <RHFFilePicker
          name="files"
          accept=".forge,application/x-scriptforge-tool"
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
                    {files[0]?.name ?? (dragging ? "Drop your .forge file here" : "Add a tool from a .forge file")}
                  </h2>
                  <p className="mt-1 mb-0 text-[12px] text-[#e0e4ff] max-[620px]:line-clamp-2">
                    {files[0]
                      ? `${formatBytes(files[0].size)} · Ready to validate and import`
                      : "ScriptForge validates the package and saves it locally. Nothing runs during import."}
                  </p>
                </div>
              </div>
              {files.length ? (
                <LoadingButton
                  className="relative shrink-0 border-white! bg-white! text-[#252945]! hover:bg-[#eef0ff]! max-[520px]:w-full"
                  size="sm"
                  type="submit"
                  loading={importTool.loading || loading}
                >
                  Import tool
                </LoadingButton>
              ) : (
                <LoadingButton
                  className="relative shrink-0 border-white! bg-white! text-[#252945]! hover:bg-[#eef0ff]! max-[520px]:w-full"
                  size="sm"
                  type="button"
                  loading={loading}
                  onClick={() => openFilePicker({ multiple: false })}
                >
                  Choose file
                </LoadingButton>
              )}
            </div>
          )}
        />
        <RHFError name="files" />
      </form>
    </FormProvider>
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
