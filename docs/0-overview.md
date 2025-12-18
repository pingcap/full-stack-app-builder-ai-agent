# Full Stack App Builder

## Required Accounts
- [Vercel](https://vercel.com/)
  - Create a separate project for each built app
  - Create a deployment preview for each prompt step
  - [Blob Storage](https://vercel.com/docs/vercel-blob) to store agent session history.
  - [Sandbox](https://vercel.com/docs/vercel-sandbox) to execute agent prompts.

- [TiDB CLoud](https://tidbcloud.com/)
  - Store agent app state
  - Create a cluster for each built app
  - Create a [branch](https://docs.pingcap.com/tidbcloud/branch-overview/) for each prompt step

- GitHub: create a separate repository for each built app
- (Optional) AWS: run EC2 instance

## Required components
- redis
- [ai-stream-proxy](/contrib/ai-stream-proxy): to persist and serve agent message stream

## Get Start

1. [Prepare Accounts](1-prepare-accounts.md)
2. [Prepare EC2](2-prepare-ec2.md)
3. [Prepare App](3-prepare-app.md)


## Limitations

- Each TiDB Cloud Account can create at most 5 free tier cluster.
- Each TiDB Cloud Project can create at most 5 branches.
