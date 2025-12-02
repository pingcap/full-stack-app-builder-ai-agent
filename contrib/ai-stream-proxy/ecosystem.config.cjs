module.exports = {
  apps: [{
    name: "ai-stream-proxy",
    exec: "./index.ts",
    instances: "3",
    interpreter: "node",
    exec_mode: "cluster",
    node_args: "--env-file .env",
    kill_timeout: 60000000,
  }]
}