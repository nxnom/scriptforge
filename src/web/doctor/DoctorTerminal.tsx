import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Circle, Stethoscope } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DoctorProposal } from "../../server/doctor/types";

export type DoctorConnectionState = "connecting" | "connected" | "installing" | "exited" | "error";

export function DoctorTerminal({
  sessionId,
  hideHeader = false,
  onConnectionChange,
  onProposal,
  onVerification,
  onSessionEnd,
}: {
  sessionId: string;
  hideHeader?: boolean;
  onConnectionChange?: (connection: DoctorConnectionState) => void;
  onProposal: (proposal: DoctorProposal | null) => void;
  onVerification: (result: { ready: boolean; message: string }) => void;
  onSessionEnd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<DoctorConnectionState>("connecting");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"SFMono-Regular", "Cascadia Code", monospace',
      fontSize: 12,
      lineHeight: 1.2,
      scrollback: 5_000,
      theme: { background: "#171717", foreground: "#e7e7e7", cursor: "#f2f2f2", selectionBackground: "#454545aa" },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.writeln("\x1b[90mConnecting to Codex Doctor…\x1b[0m");

    let disposed = false;
    let active = true;
    let socket: WebSocket | null = null;
    let inputDisposable: { dispose(): void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let secondFrame = 0;
    const updateConnection = (next: DoctorConnectionState) => {
      setConnection(next);
      onConnectionChange?.(next);
    };
    const sendSize = (target: WebSocket) => {
      if (!active || target.readyState !== WebSocket.OPEN || terminal.cols < 2 || terminal.rows < 1) return;
      target.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
    };
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (disposed) return;
        fit.fit();
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(`${protocol}//${window.location.host}/ws/doctor/${sessionId}`);
        const connectedSocket = socket;
        connectedSocket.addEventListener("open", () => {
          updateConnection("connected");
          terminal.clear();
          fit.fit();
          sendSize(connectedSocket);
          terminal.focus();
        });
        connectedSocket.addEventListener("message", (event) => {
          try {
            const message = JSON.parse(String(event.data));
            if (message.type === "output" || message.type === "install-output") terminal.write(String(message.data));
            if (message.type === "proposal") onProposal(message.proposal as DoctorProposal | null);
            if (message.type === "install-start") {
              updateConnection("installing");
              terminal.reset();
              terminal.writeln("\x1b[90mRunning the exact approved commands…\x1b[0m");
            }
            if (message.type === "verification") {
              updateConnection("connected");
              onVerification({ ready: Boolean(message.ready), message: String(message.message) });
            }
            if (message.type === "exit") {
              active = false;
              updateConnection("exited");
              onSessionEnd();
            }
            if (message.type === "error") {
              updateConnection("error");
              terminal.writeln(`\r\n\x1b[31m${String(message.message)}\x1b[0m`);
            }
          } catch {
            updateConnection("error");
            terminal.writeln("\r\n\x1b[31mInvalid Doctor terminal event.\x1b[0m");
          }
        });
        connectedSocket.addEventListener("error", () => updateConnection("error"));
        inputDisposable = terminal.onData((data) => {
          if (active && connectedSocket.readyState === WebSocket.OPEN) {
            connectedSocket.send(JSON.stringify({ type: "input", data }));
          }
        });
        resizeObserver = new ResizeObserver(() => {
          if (resizeTimer !== null) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            resizeTimer = null;
            if (!active || disposed) return;
            fit.fit();
            sendSize(connectedSocket);
          }, 50);
        });
        resizeObserver.observe(container);
      });
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      inputDisposable?.dispose();
      socket?.close(1000);
      terminal.dispose();
    };
  }, [onConnectionChange, onProposal, onSessionEnd, onVerification, sessionId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#171717]">
      {!hideHeader && (
        <div className="flex shrink-0 items-center justify-between border-[#303030] border-b px-4 py-2.5 text-[11px]">
          <span className="inline-flex items-center gap-2 font-medium text-[#c9c9c9]">
            <Stethoscope size={14} /> Codex Doctor
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#8f8f8f]">
            <Circle className={connectionColor(connection)} fill="currentColor" size={7} /> {connection}
          </span>
        </div>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 overflow-hidden p-2" />
      </div>
    </div>
  );
}

function connectionColor(connection: DoctorConnectionState) {
  if (connection === "connected") return "text-[#82be8b]";
  if (connection === "installing") return "text-[#e0a24e]";
  if (connection === "error") return "text-[#d87870]";
  return "text-[#8f8f8f]";
}
