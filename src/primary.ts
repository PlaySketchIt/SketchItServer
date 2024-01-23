import { availableParallelism } from "os";
import cluster from "cluster";

import { setupMaster } from "@socket.io/sticky";
import { setupPrimary } from "@socket.io/cluster-adapter";

import { createServer } from "http";

import minimist from "minimist";

const main = () => {
    const args = minimist(process.argv.slice(2), {
        default: {
            host: "0.0.0.0",
            port: 3000,
            threads: availableParallelism(),
        },
    });

    if (isNaN(args.port)) {
        console.error("Invalid port", args.port);
        process.exit(1);
    }

    if (args.port < 0 || args.port > 65535) {
        console.error("Port out of range", args.port);
        process.exit(1);
    }

    const threads = availableParallelism();

    console.log(`Available threads: ${threads}`);
    console.log(`Requested threads: ${args.threads}`);

    if (args.threads > threads) {
        console.error("Requested threads is greater than available threads");
        process.exit(1);
    }

    const http_server = createServer();

    // TODO: we don't need sticky session if we disable long-polling (which we should do), but don't know how to load balance on same port without sticky session
    setupMaster(http_server, {
        loadBalancingMethod: "least-connection",
    });

    setupPrimary();

    http_server.listen(args.port, args.host, () => {
        console.log(`Listening on ${args.host}:${args.port}`);
    });

    for (let i = 0; i < threads; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });
}

export default main;
