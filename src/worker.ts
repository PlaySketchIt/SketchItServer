import { setupWorker } from "@socket.io/sticky";
import { createAdapter } from "@socket.io/cluster-adapter";

import { createServer } from "http";
import { Server } from "socket.io";

const main = () => {
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
}

export default main;
