import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pgBin = `${root}.devdb/pgsql/bin`;
const dataDir = `${root}.devdb/data`;
const logFile = `${root}.devdb/postgres.log`;

if (!existsSync(dataDir)) {
  console.log("Initializing local Postgres data directory...");
  execFileSync(`${pgBin}/initdb`, ["-D", dataDir, "-U", "postgres", "--auth=trust", "--no-locale", "-E", "UTF8"], {
    stdio: "inherit",
  });
}

const status = spawnSync(`${pgBin}/pg_ctl`, ["-D", dataDir, "status"]);
if (status.status === 0) {
  console.log("Local Postgres is already running.");
  process.exit(0);
}

execFileSync(
  `${pgBin}/pg_ctl`,
  ["-D", dataDir, "-l", logFile, "-o", "-p 5432 -k /tmp -c listen_addresses='127.0.0.1'", "start"],
  { stdio: "inherit" }
);
console.log("Local Postgres started on 127.0.0.1:5432");
