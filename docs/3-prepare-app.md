# Prepare Agent App

## Clone repositories

```shell
git clone https://github.com/pingcap/full-stack-app-builder-ai-agent
```

## Setup environment

```shell
cd full-stack-app-builder-ai-agent
touch .env
```

Setup environment variables listed below:

```dotenv
DATABASE_URL=mysql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>
STREAM_PROXY_URL=http://<ec2-ip>:3001
BCRYPT_SALT=# node -e 'await import("bcrypt").then((bcrypt) => bcrypt.genSalt(6)).then(console.log);'

# You can find the endpoint and region in your cluster connection url.
TIDB_CLOUD_DATABASE_ENDPOINT=gateway01.us-east-1.prod.aws.tidbcloud.com
TIDB_CLOUD_PROVIDER=aws
TIDB_CLOUD_REGION=aws-us-east-1

# Run "openssl rand -base64 32" to genreate a secret
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=# http://<ec2-ip>

# Run "openssl rand -hex 16" to genreate a token
HOOK_AUTH_TOKEN=
HOOK_BASE_URL=# http://<ec2-ip>

CODEX_API_KEY=#
ANTHROPIC_BASE_URL=#
ANTHROPIC_API_KEY=#
ANTHROPIC_AUTH_TOKEN=#

OPENAI_API_KEY=#
```


## Prepare source codes

ai-stream-proxy
```shell
cd full-stack-app-builder-ai-agent/contrib/ai-stream-proxy
npm i
```

```shell
cd full-stack-app-builder-ai-agent
npm i

cd contrib/ai-stream-proxy
npm i

cd ../..

npm run build
```
