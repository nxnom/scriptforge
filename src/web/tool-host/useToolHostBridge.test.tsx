import { cleanup, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToolHostBridge } from "./useToolHostBridge";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useToolHostBridge", () => {
  it("installs before tool startup and accepts a run with no files", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const startJob = vi.fn(async () => ({ jobId: "job-1" }));
    const { container } = render(<BridgeHarness startJob={startJob} />);
    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("Test iframe is unavailable.");
    const postMessage = vi.spyOn(iframe.contentWindow, "postMessage");

    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { source: "scriptforge-tool", type: "ready" },
      }),
    );
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ source: "scriptforge-host", type: "ready" }, "*"));

    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { source: "scriptforge-tool", type: "run", input: { currency: "USD" }, files: [] },
      }),
    );

    await waitFor(() => expect(startJob).toHaveBeenCalledWith(expect.objectContaining({ files: [] })));
    expect(postMessage).toHaveBeenCalledWith({ source: "scriptforge-host", type: "accepted" }, "*");
  });

  it("waits for host-side configuration before accepting the run", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    let finish: ((result: { jobId: string }) => void) | undefined;
    const startJob = vi.fn(() => new Promise<{ jobId: string }>((resolve) => (finish = resolve)));
    const { container } = render(<BridgeHarness startJob={startJob} />);
    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("Test iframe is unavailable.");
    const postMessage = vi.spyOn(iframe.contentWindow, "postMessage");

    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { source: "scriptforge-tool", type: "run", input: {}, files: [] },
      }),
    );
    await waitFor(() => expect(startJob).toHaveBeenCalled());
    expect(postMessage).not.toHaveBeenCalledWith({ source: "scriptforge-host", type: "accepted" }, "*");

    finish?.({ jobId: "job-1" });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({ source: "scriptforge-host", type: "accepted" }, "*"),
    );
  });

  it("does not mount the host bridge while a tool is blocked", async () => {
    const startJob = vi.fn(async () => ({ jobId: "job-1" }));
    const { container } = render(<BridgeHarness startJob={startJob} enabled={false} />);
    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("Test iframe is unavailable.");

    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { source: "scriptforge-tool", type: "run", input: {}, files: [] },
      }),
    );

    await waitFor(() => expect(iframe).toHaveAttribute("data-listening", "false"));
    expect(startJob).not.toHaveBeenCalled();
  });

  it("keeps successful status and unique diagnostics when the start callback changes", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    const firstStart = vi.fn(async () => ({ jobId: "job-1" }));
    const { container, rerender } = render(<BridgeHarness startJob={firstStart} />);
    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("Test iframe is unavailable.");

    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { source: "scriptforge-tool", type: "run", input: {}, files: [] },
      }),
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    FakeWebSocket.instances[0]?.emit({ type: "status", status: "succeeded" });
    await waitFor(() => expect(iframe).toHaveAttribute("data-status", "succeeded"));

    rerender(<BridgeHarness startJob={vi.fn(async () => ({ jobId: "job-2" }))} />);

    expect(iframe).toHaveAttribute("data-status", "succeeded");
    const diagnosticIds = JSON.parse(iframe.dataset.diagnosticIds ?? "[]") as string[];
    expect(new Set(diagnosticIds).size).toBe(diagnosticIds.length);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

function BridgeHarness({
  startJob,
  enabled = true,
}: {
  startJob: () => Promise<{ jobId: string }>;
  enabled?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridge = useToolHostBridge({ iframeRef, startJob, enabled });
  return (
    <iframe
      ref={iframeRef}
      title="tool"
      data-listening={bridge.listening}
      data-status={bridge.jobStatus}
      data-diagnostic-ids={JSON.stringify(bridge.diagnostics.map((entry) => entry.id))}
    />
  );
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  emit(payload: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
  }
  close() {}
}
