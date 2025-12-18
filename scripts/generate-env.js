import { genSaltSync } from "bcrypt";
import { sh } from "./common.js";

const ip = sh("curl", "-s", "http://checkip.amazonaws.com/");

const template = `DATABASE_URL="mysql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>"

CODEX_PROVIDER_BASE_URL=
CODEX_PROVIDER_API_KEY=

ANTHROPIC_BASE_URL=
ANTHROPIC_AUTH_TOKEN=

OPENAI_API_KEY=

TIDB_CLOUD_DATABASE_ENDPOINT="gateway01.us-east-1.prod.aws.tidbcloud.com"
TIDB_CLOUD_PROVIDER="aws"
TIDB_CLOUD_REGION="aws-us-east-1"
TIDB_CLOUD_FREE_TIER="1"

STREAM_PROXY_URL="http://${ip}:3001"

BCRYPT_SALT=${JSON.stringify(genSaltSync(6))}

BETTER_AUTH_SECRET=${JSON.stringify(sh("openssl", "rand", "-base64", "32"))}
BETTER_AUTH_URL="http://${ip}"

HOOK_AUTH_TOKEN=${JSON.stringify(sh("openssl", "rand", "-hex", "16"))}
HOOK_BASE_URL="http://${ip}"
`;

console.log(template);

