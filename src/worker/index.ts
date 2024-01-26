import { setupWorker } from "@socket.io/sticky";
import { createAdapter } from "@socket.io/cluster-adapter";

import { createServer } from "http";
import { Server } from "socket.io";
import { validate_auth_header } from "./auth";

const MAX_USERNAME_LENGTH = 16;

// TODO: united method for IPC
const create_lobby_code = async () => {
    return new Promise<string>((resolve, reject) => {
        let received = false;
        const timestamp = Date.now();

        // TODO: type message
        const callback = (message) => {
            if (message.type === "allocated_code" && message.timestamp === timestamp) {
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
            timestamp,
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

const check_code_exists = async (code: string) => {
    return new Promise<boolean>((resolve, reject) => {
        let received = false;
        const timestamp = Date.now();

        // TODO: type message
        const callback = (message) => {
            if (message.type === "code_exists" && message.timestamp === timestamp) {
                received = true;

                // remove listener
                process.removeListener("message", callback);

                // resolve promise
                resolve(message.exists);
            }
        };

        // listen for allocated code message from primary
        process.on("message", callback);

        // request code from primary
        process.send({
            timestamp,
            type: "check_code_exists",
            code,
        });

        // reject promise if no response received after 3 seconds
        setTimeout(() => {
            if (received) {
                return;
            }

            reject("No response received");
        }, 3000);
    });
};

const main = async () => {
    const http_server = createServer();
    const io = new Server(http_server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    // TODO: setup cors properly!!!!

    io.adapter(createAdapter());
    setupWorker(io);

    // middleware to validate code
    io.use(async (socket, next) => {
        console.log(`Socket ${socket.id} initialising connection to worker ${process.pid} with IP ${socket.handshake.address}`);

        const code = socket.handshake.query.code as string | undefined;

        if (!code) {
            console.log(`Socket ${socket.id} disconnected from worker ${process.pid} due to missing code`);
            next(new Error("user:missing code"));
            return;
        }

        if (!(await check_code_exists(code))) {
            console.log(`Socket ${socket.id} disconnected from worker ${process.pid} due to non-existent code`);
            next(new Error("user:invalid code"));
            return;
        }

        next();
    });

    // middleware to validate username
    io.use(async (socket, next) => {
        const username = socket.handshake.query.username as string | undefined;

        if (!username) {
            console.log(`Socket ${socket.id} disconnected from worker ${process.pid} due to missing username`);
            next(new Error("user:missing username"));
            return;
        }

        if (username.length > MAX_USERNAME_LENGTH) {
            console.log(`Socket ${socket.id} disconnected from worker ${process.pid} due to too long username`);
            next(new Error("user:username too long"));
            return;
        }

        next();
    });

    // middleware to check presence of reconnection key
    // TODO: implement. client will generate a uuid and store it in local storage, then send it as a query parameter when connecting
    // to allow reconnection and unique identification of the client (username may be non-unique or changed)
    // its probably a good idea to never tell the clients other clients' reconnection keys so they can't impersonate them
    //io.use(async (socket, next) => {
    //    const reconnection_key = socket.handshake.query.reconnection_key as string | undefined;
    //
    //    if (!reconnection_key) {
    //        next(new Error("Missing reconnection key"));
    //        return;
    //    }
    //
    //    next();
    //});

    io.use((socket, _next) => {
        console.log(`Socket ${socket.id} fully connected to worker ${process.pid} with code ${socket.handshake.query.code}, username ${socket.handshake.query.username}`);

        // join room for code
        socket.join(socket.handshake.query.code as string);

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
        const url = new URL(request.url, "http://example.com");
        const endpoint = url.pathname.replace(/\/$/, "");

        if (endpoint === "/socket.io") {
            // ignore socket.io requests
            return;
        }

        if (!validate_auth_header(request.headers.authorization)) {
            response.writeHead(401);
            response.end("Unauthorized");
            return;
        }

        switch (endpoint) {
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
};

export default main;

// TODO: split into separate files
// TODO: disconnect clients when lobby is destroyed
