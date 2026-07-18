import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Circle, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ConnectionState = "connecting" | "connected" | "exited" | "error";

type ForgeTerminalProps = {
  sessionId: string;
  onSessionEnd: (sessionId: string) => void;
};

export function ForgeTerminal({ sessionId, onSessionEnd }: ForgeTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: false,
      fontFamily: '"SFMono-Regular", "Cascadia Code", "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5_000,
      theme: {
        background: "#171717",
        foreground: "#e7e7e7",
        cursor: "#f2f2f2",
        selectionBackground: "#454545aa",
        black: "#202020",
        brightBlack: "#777777",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.writeln("\x1b[90mConnecting to the local Codex CLI…\x1b[0m");

    let disposed = false;
    let active = true;
    let socket: WebSocket | null = null;
    let inputDisposable: { dispose(): void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let secondFrame = 0;
    const sendSize = (target: WebSocket) => {
      if (!active || target.readyState !== WebSocket.OPEN || terminal.cols < 2 || terminal.rows < 1) return;
      target.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
    };
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (disposed) return;
        fit.fit();

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(`${protocol}//${window.location.host}/ws/forge/${sessionId}`);
        const connectedSocket = socket;
        connectedSocket.addEventListener("open", () => {
          setConnection("connected");
          terminal.clear();
          fit.fit();
          sendSize(connectedSocket);
          terminal.focus();
        });
        connectedSocket.addEventListener("message", (event) => {
          try {
            const message = JSON.parse(String(event.data));
            if (message.type === "output") terminal.write(String(message.data));
            if (message.type === "exit") {
              active = false;
              setConnection("exited");
              terminal.writeln(`\r\n\x1b[90mCodex exited with code ${Number(message.exitCode)}.\x1b[0m`);
              onSessionEnd(sessionId);
            }
            if (message.type === "error") {
              active = false;
              setConnection("error");
              terminal.writeln(`\r\n\x1b[31m${String(message.message)}\x1b[0m`);
              if (String(message.message).includes("does not exist")) onSessionEnd(sessionId);
            }
          } catch {
            active = false;
            setConnection("error");
            terminal.writeln("\r\n\x1b[31mScriptForge received an invalid terminal event.\x1b[0m");
          }
        });
        connectedSocket.addEventListener("error", () => {
          active = false;
          setConnection("error");
        });
        connectedSocket.addEventListener("close", () => {
          active = false;
          setConnection((current) => (current === "connected" ? "exited" : current));
        });

        inputDisposable = terminal.onData((data) => {
          if (active && connectedSocket.readyState === WebSocket.OPEN) {
            connectedSocket.send(JSON.stringify({ type: "input", data }));
          }
        });
        resizeObserver = new ResizeObserver(() => {
          if (resizeTimer !== null) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            resizeTimer = null;
            if (disposed || !active) return;
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
      resizeObserver?.disconnect();
      inputDisposable?.dispose();
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      socket?.close(1000);
      terminal.dispose();
    };
  }, [onSessionEnd, sessionId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#171717]">
      <div className="flex shrink-0 items-center justify-between border-[#303030] border-b px-4 py-2.5 text-[11px]">
        <span className="inline-flex items-center gap-2 font-medium text-[#c9c9c9]">
          <TerminalSquare size={14} /> Interactive Codex
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#8f8f8f]">
          <Circle className={connectionColor(connection)} fill="currentColor" size={7} /> {connectionLabel(connection)}
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
  if (connection === "error") return "text-[#d87870]";
  return "text-[#8f8f8f]";
}

function connectionLabel(connection: ConnectionState) {
  return { connecting: "Connecting", connected: "Connected", exited: "Exited", error: "Connection error" }[connection];
}
