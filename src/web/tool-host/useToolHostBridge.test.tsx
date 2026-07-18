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
});

function BridgeHarness({ startJob }: { startJob: () => Promise<{ jobId: string }> }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridge = useToolHostBridge({ iframeRef, startJob });
  return <iframe ref={iframeRef} title="tool" data-listening={bridge.listening} />;
}

class FakeWebSocket {
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  constructor(readonly url: string) {}
  close() {}
}
