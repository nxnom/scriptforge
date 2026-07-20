import {
  Button,
  Label,
  LoadingButton,
  RHFCheckbox,
  RHFError,
  RHFInput,
  RHFNumberInput,
  RHFSelect,
  RHFSwitch,
  RHFTextarea,
  SelectOption,
} from "@geckoui/geckoui";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import type { ToolConfigurationField } from "../../tools/manifest";

export type ConfigurationFieldStatus = ToolConfigurationField & { configured: boolean; value?: unknown };
export type ConfigurationUpdate = { values: Record<string, unknown>; clearSecrets: string[] };

export function ToolConfigurationForm({
  fields,
  saving,
  onSave,
  onCancel,
  showHeading = true,
}: {
  fields: ConfigurationFieldStatus[];
  saving: boolean;
  onSave: (update: ConfigurationUpdate) => Promise<void>;
  onCancel: () => void;
  showHeading?: boolean;
}) {
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(configurationSchema(fields)),
    defaultValues: configurationDefaults(fields),
  });
  const submit = form.handleSubmit(async (values) => {
    const clearSecrets = fields
      .filter((field) => field.type === "secret" && values[clearKey(field.key)] === true)
      .map((field) => field.key);
    const cleaned = Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith("__clear_")));
    await onSave({ values: cleaned, clearSecrets });
  });

  return (
    <FormProvider {...form}>
      <form className="flex max-h-[70vh] flex-col gap-4" onSubmit={submit}>
        {showHeading && (
          <div>
            <h2 className="m-0 font-[Geist_Variable] text-lg">Tool configuration</h2>
            <p className="mt-1.5 mb-0 text-xs text-[#929292]">
              Saved locally. Private values are encrypted and never included when you export the tool.
            </p>
          </div>
        )}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {fields.map((field) => (
            <ConfigurationField key={field.key} field={field} />
          ))}
        </div>
        <div className="flex justify-end gap-2 border-[#333] border-t pt-3">
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <LoadingButton type="submit" size="sm" loading={saving} loadingText="Saving…">
            Save configuration
          </LoadingButton>
        </div>
      </form>
    </FormProvider>
  );
}

function ConfigurationField({ field }: { field: ConfigurationFieldStatus }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[#333] bg-[#202020] p-3">
      <Label
        htmlFor={["text", "secret", "textarea", "number"].includes(field.type) ? field.key : undefined}
        required={field.required}
      >
        {field.label}
      </Label>
      {field.description && <p className="m-0 text-[11px] text-[#929292] leading-4">{field.description}</p>}
      {field.type === "textarea" ? (
        <RHFTextarea id={field.key} name={field.key} rows={3} placeholder={field.placeholder} />
      ) : field.type === "number" ? (
        <RHFNumberInput id={field.key} name={field.key} />
      ) : field.type === "boolean" ? (
        <RHFSwitch name={field.key} />
      ) : field.type === "select" ? (
        <RHFSelect name={field.key} placeholder={`Choose ${field.label.toLowerCase()}`}>
          {field.options.map((option) => (
            <SelectOption key={option.value} value={option.value} label={option.label} />
          ))}
        </RHFSelect>
      ) : (
        <RHFInput
          name={field.key}
          id={field.key}
          type={field.type === "secret" ? "password" : "text"}
          autoComplete={field.type === "secret" ? "new-password" : "off"}
          placeholder={
            field.type === "secret" && field.configured ? "Saved — leave blank to keep it" : field.placeholder
          }
        />
      )}
      {field.type === "secret" && field.configured && (
        <RHFCheckbox
          name={clearKey(field.key)}
          single
          value={true}
          uncheckedValue={false}
          label="Remove saved value"
          labelClassName="text-[11px] text-[#b0b0b0]"
        />
      )}
      <RHFError name={field.key} />
    </div>
  );
}

function configurationDefaults(fields: ConfigurationFieldStatus[]) {
  return Object.fromEntries(
    fields.flatMap((field) => [
      [field.key, field.type === "secret" ? "" : (field.value ?? defaultFor(field))],
      ...(field.type === "secret" && field.configured ? [[clearKey(field.key), false]] : []),
    ]),
  );
}

function configurationSchema(fields: ConfigurationFieldStatus[]) {
  return z.object(
    Object.fromEntries(
      fields.flatMap((field) => [
        [field.key, fieldSchema(field)],
        ...(field.type === "secret" && field.configured ? [[clearKey(field.key), z.boolean()]] : []),
      ]),
    ),
  );
}

function fieldSchema(field: ConfigurationFieldStatus): z.ZodType {
  if (field.type === "boolean") return z.boolean();
  if (field.type === "number") {
    let schema = z.number({ message: `${field.label} must be a number.` });
    if (field.minimum !== undefined) schema = schema.min(field.minimum);
    if (field.maximum !== undefined) schema = schema.max(field.maximum);
    return z.preprocess((value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value), schema);
  }
  if (field.type === "select") {
    const values = new Set(field.options.map((option) => option.value));
    return z
      .string()
      .refine((value) => (!field.required && value === "") || values.has(value), `Choose ${field.label}.`);
  }
  let schema = z.string().max(8_000, `${field.label} is too long.`);
  if (field.required && !(field.type === "secret" && field.configured)) {
    schema = schema.trim().min(1, `${field.label} is required.`);
  }
  return schema;
}

function defaultFor(field: ToolConfigurationField) {
  if ("defaultValue" in field && field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "boolean") return false;
  if (field.type === "number") return 0;
  return "";
}

function clearKey(key: string) {
  return `__clear_${key}`;
}
