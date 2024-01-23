import { createServer } from "http";
import { Server } from "socket.io";

import minimist from "minimist";

const args = minimist(process.argv.slice(2), {
    default: {
        host: "0.0.0.0",
        port: 8080,
    },
});

// check if the port is valid
if (isNaN(args.port)) {
    console.error("Port must be a number");
    process.exit(1);
}

// check if the port is in range
if (args.port < 0 || args.port > 65535) {
    console.error("Port must be in range 0-65535");
    process.exit(1);
}

const http_server = createServer();
const io = new Server(http_server);

io.on("connection", (socket) => {
    console.log("New connection", socket.id);

    socket.on("disconnect", () => {
        console.log("Disconnected", socket.id);
    });

    socket.on("message", (data) => {
        console.log("Message", socket.id, data);
        socket.broadcast.emit("message", data);
    });
});

http_server.listen(args.port, args.host, () => {
    console.log(`Server listening on ${args.host}:${args.port}`);
});
