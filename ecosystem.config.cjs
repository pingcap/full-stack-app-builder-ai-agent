const path = require("path");

module.exports = {
  apps: [
    {
      name: "ai-stream-proxy",
      cwd: path.join(__dirname, "contrib/ai-stream-proxy"),
      exec: "./index.ts",
      instances: 1,
      interpreter: "node",
      exec_mode: "cluster",
      kill_timeout: 60000000,
    },
    {
      name: "server",
      cwd: __dirname,
      script: "npm",
      args: "start -H 0.0.0.0",
      instances: 1,
    },
  ],
};
