import { createSocketGateway } from "./transport/socket-gateway";

export { attachSocketHandlers } from "./transport/socket-gateway";

const port = Number.parseInt(process.env.SERVER_PORT ?? "3001", 10);

const gateway = createSocketGateway(port);

gateway
  .start()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Blocker Rush server listening on :${port}`);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", error);
    process.exitCode = 1;
  });
