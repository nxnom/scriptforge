import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Circle, Stethoscope } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DoctorProposal } from "../../server/doctor/types";

type ConnectionState = "connecting" | "connected" | "installing" | "exited" | "error";

export function DoctorTerminal({
  sessionId,
  onProposal,
  onVerification,
  onSessionEnd,
}: {
  sessionId: string;
  onProposal: (proposal: DoctorProposal | null) => void;
  onVerification: (result: { ready: boolean; message: string }) => void;
  onSessionEnd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"SFMono-Regular", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5_000,
      theme: { background: "#171717", foreground: "#e7e7e7", cursor: "#f2f2f2", selectionBackground: "#454545aa" },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.writeln("\x1b[90mConnecting to Codex Doctor…\x1b[0m");

    let active = true;
    let disposed = false;
    let socket: WebSocket | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      if (disposed) return;
      fit.fit();
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/doctor/${sessionId}`);
      socket.onopen = () => {
        setConnection("connected");
        terminal.clear();
        fit.fit();
        socket?.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
        terminal.focus();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === "output" || message.type === "install-output") terminal.write(String(message.data));
          if (message.type === "proposal") onProposal(message.proposal as DoctorProposal | null);
          if (message.type === "install-start") {
            setConnection("installing");
            terminal.reset();
            terminal.writeln("\x1b[90mRunning the exact approved commands…\x1b[0m");
          }
          if (message.type === "verification") {
            setConnection("connected");
            onVerification({ ready: Boolean(message.ready), message: String(message.message) });
          }
          if (message.type === "exit") {
            active = false;
            setConnection("exited");
            onSessionEnd();
          }
          if (message.type === "error") {
            setConnection("error");
            terminal.writeln(`\r\n\x1b[31m${String(message.message)}\x1b[0m`);
          }
        } catch {
          setConnection("error");
          terminal.writeln("\r\n\x1b[31mInvalid Doctor terminal event.\x1b[0m");
        }
      };
      socket.onerror = () => setConnection("error");
      terminal.onData((data) => {
        if (active && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input", data }));
      });
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!active || disposed || socket?.readyState !== WebSocket.OPEN) return;
          fit.fit();
          socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
        }, 50);
      });
      resizeObserver.observe(container);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      socket?.close();
      terminal.dispose();
    };
  }, [onProposal, onSessionEnd, onVerification, sessionId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#171717]">
      <div className="flex items-center justify-between border-[#303030] border-b px-4 py-2.5 text-[11px]">
        <span className="inline-flex items-center gap-2 font-medium text-[#c9c9c9]">
          <Stethoscope size={14} /> Codex Doctor
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#8f8f8f]">
          <Circle className={connectionColor(connection)} fill="currentColor" size={7} /> {connection}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 overflow-hidden p-3" />
      </div>
    </div>
  );
}

function connectionColor(connection: ConnectionState) {
  if (connection === "connected") return "text-[#82be8b]";
  if (connection === "installing") return "text-[#e0a24e]";
  if (connection === "error") return "text-[#d87870]";
  return "text-[#8f8f8f]";
}
