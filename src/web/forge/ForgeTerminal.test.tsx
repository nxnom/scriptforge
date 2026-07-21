import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgeTerminal } from "./ForgeTerminal";

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon() {}
    open() {}
    writeln() {}
    write() {}
    clear() {}
    focus() {}
    dispose() {}
    onData() {
      return { dispose() {} };
    }
  },
}));

describe("ForgeTerminal", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the same socket when parent callbacks change", () => {
    const firstCandidate = vi.fn();
    const latestCandidate = vi.fn();
    const props = {
      sessionId: "session-1",
      onSessionEnd: vi.fn(),
      onPanel: vi.fn(),
      onCandidate: firstCandidate,
    };
    const view = render(<ForgeTerminal {...props} />);

    expect(FakeWebSocket.instances).toHaveLength(1);
    view.rerender(<ForgeTerminal {...props} onCandidate={latestCandidate} />);

    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0]?.emit("message", {
      data: JSON.stringify({ type: "candidate", candidate: { revision: "next" } }),
    });
    expect(firstCandidate).not.toHaveBeenCalled();
    expect(latestCandidate).toHaveBeenCalledWith({ revision: "next" });
  });

  it("copies focused example prompts without writing them to the terminal", async () => {
    const props = {
      sessionId: "session-1",
      onSessionEnd: vi.fn(),
      onPanel: vi.fn(),
      onCandidate: vi.fn(),
    };
    render(<ForgeTerminal {...props} />);

    act(() => FakeWebSocket.instances[0]?.emit("open"));
    for (const title of ["Time-zone planner", "Color mixer", "Date calculator"]) {
      fireEvent.click(screen.getByRole("button", { name: "Example prompts" }));
      fireEvent.click(screen.getByRole("menuitem", { name: `Copy ${title} prompt` }));
    }

    const messages = FakeWebSocket.instances[0]?.sent.map((message) => JSON.parse(message));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);
    for (const [prompt] of vi.mocked(navigator.clipboard.writeText).mock.calls) {
      expect(prompt).toMatch(/^Forge a /);
      expect(prompt).not.toContain("three distinct UI designs");
      expect(prompt).not.toContain("#151515");
    }
    expect(messages?.some((message) => message.type === "input")).toBe(false);
    expect(screen.getByRole("button", { name: "Example prompts" })).toBeVisible();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, event: Partial<MessageEvent> = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as MessageEvent);
  }

  send(message: string) {
    this.sent.push(message);
  }
  close() {}
}
