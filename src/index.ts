import cluster from "cluster";

import run_primary from "./primary";
import run_worker from "./worker";

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);
    run_primary();
} else {
    console.log(`Worker ${process.pid} started`);
    run_worker();
}
