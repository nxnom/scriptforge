import { LoadingButton, RHFError, RHFFilePicker, toast } from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { form as spooshForm } from "@spoosh/core";
import { FileArchive, Upload } from "lucide-react";
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
              className={`flex min-h-15 items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors ${dragging ? "border-[#777] bg-[#363636]" : "border-[#454545] bg-[#303030]"}`}
            >
              <div className="flex min-w-0 items-center gap-3 text-xs text-[#b0b0b0]">
                {files.length ? (
                  <FileArchive className="shrink-0" size={17} />
                ) : (
                  <Upload className="shrink-0" size={17} />
                )}
                <div className="min-w-0">
                  <p className="m-0 truncate text-[#dedede]">
                    {files[0]?.name ?? (dragging ? "Drop the .forge file" : "Import a shared .forge tool")}
                  </p>
                  <p className="mt-0.5 mb-0 text-[10px] text-[#898989]">
                    {files[0] ? formatBytes(files[0].size) : "Validated and saved locally without running it"}
                  </p>
                </div>
              </div>
              {files.length ? (
                <LoadingButton size="sm" type="submit" loading={importTool.loading || loading}>
                  Import tool
                </LoadingButton>
              ) : (
                <LoadingButton
                  className="border-[#555] text-[#ececec]"
                  size="sm"
                  type="button"
                  variant="outlined"
                  loading={loading}
                  onClick={() => openFilePicker({ multiple: false })}
                >
                  Browse files
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
