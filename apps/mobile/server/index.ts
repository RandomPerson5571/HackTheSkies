import process from "node:process";
import { createApiServer } from "./http.ts";
const port = Number(process.env.API_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("API_PORT must be between 1 and 65535.");
const server = createApiServer();
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Stop the old server or set API_PORT and update the app’s API URLs.`
      : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, process.env.API_HOST || "0.0.0.0", () =>
  console.log(`Cibo API and built browser app: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
