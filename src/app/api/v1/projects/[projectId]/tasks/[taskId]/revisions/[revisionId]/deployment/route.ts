import { Vercel } from "@vercel/sdk";
import type { CreateCustomEnvironmentResponseBody } from "@vercel/sdk/models/createcustomenvironmentop";
import type { GetCustomEnvironmentResponseBody } from "@vercel/sdk/models/getcustomenvironmentop";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/db";
import { get, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ projectId: string; taskId: string; revisionId: string }>;
  },
) {
  const settings = await getSiteSettings();

  if (!settings) {
    return NextResponse.json({
      message: "Please login first.",
    });
  }

  const projectId = parseInt(decodeURIComponent((await params).projectId), 10);
  const taskId = parseInt(decodeURIComponent((await params).taskId), 10);
  const taskRevisionId = parseInt(
    decodeURIComponent((await params).revisionId),
    10,
  );

  const project = await get(db, "project", { id: projectId });
  const task = await get(db, "task", { id: taskId });
  const taskRevision = await get(db, "task_revision", { id: taskRevisionId });

  if (!taskRevision.git_commit_sha) {
    return NextResponse.json({
      message: "task revision not committed.",
    });
  }

  if (!taskRevision.tidbcloud_branch_id) {
    return NextResponse.json({
      message: "no connection info",
    });
  }

  const branch = await get(db, "tidbcloud_branch", {
    id: taskRevision.tidbcloud_branch_id,
  });

  if (!branch.connection_url) {
    return NextResponse.json({
      message: "no connection info",
    });
  }

  const vercel = new Vercel({
    bearerToken: project.vercel_team_token,
  });

  let env:
    | GetCustomEnvironmentResponseBody
    | CreateCustomEnvironmentResponseBody;

  try {
    env = await vercel.environment.getCustomEnvironment({
      teamId: project.vercel_team_id,
      idOrName: project.vercel_project_id,
      environmentSlugOrId: "codegen-tidb-ai-preview",
    });
  } catch (e) {
    console.error(e);
    env = await vercel.environment.createCustomEnvironment({
      teamId: project.vercel_team_id,
      idOrName: project.vercel_project_id,
      requestBody: {
        slug: "codegen-tidb-ai-preview",
        description: `This environment is used to deploy codes generated from codegen.tidb.ai. The environment variables will be updated before each deployment execution. do not add env variables to this project.`,
      },
    });
  }

  await vercel.projects.createProjectEnv({
    teamId: project.vercel_team_id,
    idOrName: project.vercel_project_id,
    upsert: "true",
    requestBody: [
      {
        key: "DATABASE_URL",
        value: branch.connection_url,
        customEnvironmentIds: [env.id],
        target: [],
        type: "encrypted",
      },
      {
        key: "OPENAI_API_KEY",
        value: process.env.OPENAI_API_KEY ?? "",
        customEnvironmentIds: [env.id],
        target: [],
        type: "encrypted",
      },
    ],
  });

  const deployment = await vercel.deployments.createDeployment({
    forceNew: "1",
    teamId: project.vercel_team_id,
    requestBody: {
      name: project.github_repo,
      gitSource: {
        org: project.github_owner,
        repo: project.github_repo,
        ref: task.git_branch_name,
        sha: taskRevision.git_commit_sha,
        type: "github",
      },
      project: project.vercel_project_id,
      projectSettings: {
        nodeVersion: "24.x",
        serverlessFunctionRegion: "sin1",
        framework: "nextjs",
      },
      customEnvironmentSlugOrId: env.id,
    },
  });

  await update(
    db,
    "task_revision",
    {
      vercel_deployment_id: deployment.id,
    },
    { id: taskRevisionId },
  );

  return NextResponse.json(deployment);
}

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ projectId: string; taskId: string; revisionId: string }>;
  },
) {
  const projectId = parseInt(decodeURIComponent((await params).projectId), 10);
  const taskId = parseInt(decodeURIComponent((await params).taskId), 10);
  const taskRevisionId = parseInt(
    decodeURIComponent((await params).revisionId),
    10,
  );

  const project = await get(db, "project", { id: projectId });
  const task = await get(db, "task", { id: taskId });
  const taskRevision = await get(db, "task_revision", { id: taskRevisionId });

  if (!taskRevision.vercel_deployment_id) {
    return NextResponse.json(
      {
        message: "No deployment found.",
      },
      { status: 404 },
    );
  }

  const vercel = new Vercel({
    bearerToken: project.vercel_team_token,
  });

  const deployment = await vercel.deployments.getDeployment({
    teamId: project.vercel_team_id,
    idOrUrl: taskRevision.vercel_deployment_id,
  });

  if (deployment.readyState === "ERROR") {
    const events = await vercel.deployments.getDeploymentEvents({
      teamId: project.vercel_team_id,
      idOrUrl: taskRevision.vercel_deployment_id,
      limit: -1,
    });
    Object.assign(deployment, { events });
  }

  return NextResponse.json(deployment);
}
