# Full Stack App Builder

## Required Accounts
- [Vercel](https://vercel.com/)
  - Create separate project for each built app
  - Create a deployment preview for each prompt step
  - [Blob Storage](https://vercel.com/docs/vercel-blob) to store agent session history.
  - [Sandbox](https://vercel.com/docs/vercel-sandbox) to execute agent prompts.

- [TiDB CLoud](https://tidbcloud.com/)
  - Store agent app state
  - Create cluster for each built app
  - Create [branch](https://docs.pingcap.com/tidbcloud/branch-overview/) for each prompt step

- GitHub: create separate repository for each built app
- (Optional) AWS: run EC2 instance

## Required components
- redis
- [ai-stream-proxy](/contrib/ai-stream-proxy): to persist and serve agent message stream

## Get Start