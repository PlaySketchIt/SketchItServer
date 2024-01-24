import { setupWorker } from "@socket.io/sticky";
import { createAdapter } from "@socket.io/cluster-adapter";

import { createServer } from "http";
import { Server } from "socket.io";
import { validate_auth_header } from "./auth";

const create_lobby_code = async () => {
    return new Promise<string>((resolve, reject) => {
        let received = false;

        // TODO: type message
        const callback = (message) => {
            if (message.type === "allocated_code") {
                console.log(`Worker ${process.pid} allocated code ${message.code}`);

                received = true;

                // remove listener
                process.removeListener("message", callback);

                // resolve promise
                resolve(message.code);
            }
        };

        // listen for allocated code message from primary
        process.on("message", callback);

        // request code from primary
        process.send({
            type: "allocate",
        });

        // reject promise if no code received after 3 seconds
        setTimeout(() => {
            if (received) {
                return;
            }

            reject("No code received");
        }, 3000);
    });
};

const main = async () => {
    const http_server = createServer();
    const io = new Server(http_server);

    io.adapter(createAdapter());
    setupWorker(io);

    io.on("connection", (socket) => {
        console.log(`Socket ${socket.id} connected to worker ${process.pid}`);

        socket.on("disconnect", () => {
            console.log(`Socket ${socket.id} disconnected from worker ${process.pid}`);
        });

        // echo received message
        socket.on("message", (message) => {
            console.log(`Socket ${socket.id} received message: ${message}`);
            socket.send(message);
        });
    });

    // create route
    // TODO: check request type
    // TODO: switch to express
    // TODO: REST?
    // TODO: rate limit. may be best at primary level
    http_server.on("request", async (request, response) => {
        if (!validate_auth_header(request.headers.authorization)) {
            response.writeHead(401);
            response.end("Unauthorized");
            return;
        }

        const url = new URL(request.url, "http://example.com");

        switch (url.pathname) {
            case "/create": {
                const code = await create_lobby_code();

                response.writeHead(200);
                response.end(code);
                break;
            }
            case "/destroy": {
                const code = url.searchParams.get("code");

                if (code === undefined) {
                    response.writeHead(400);
                    response.end("Missing code");
                    break;
                }

                process.send({
                    type: "deallocate",
                    code,
                });

                response.writeHead(200);
                response.end("OK");
                break;
            }
            default:
                response.writeHead(404);
                response.end("Not found");
                break;
        }
    });
}

export default main;
