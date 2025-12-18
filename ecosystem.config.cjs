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
      env: {
        PORT: 3001
      }
    },
    {
      name: "server",
      cwd: __dirname,
      script: "npm",
      args: "start",
      instances: 1,
      env: {
        PORT: 80
      }
    },
  ],
};
