import { createServer } from "node:net";

const HOST = "127.0.0.1";

function probePort(port: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(null);
        return;
      }
      reject(error);
    });
    probe.listen({ host: HOST, port }, () => {
      const address = probe.address();
      const selected = typeof address === "object" && address ? address.port : null;
      probe.close(() => resolve(selected));
    });
  });
}

export async function selectPort(preferred = 4545): Promise<number> {
  return (await probePort(preferred)) ?? (await probePort(0)) ?? Promise.reject(new Error("No local port available"));
}
