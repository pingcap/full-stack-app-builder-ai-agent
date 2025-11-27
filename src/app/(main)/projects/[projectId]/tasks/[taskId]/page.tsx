"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import Form from "next/form";
import { use } from "react";

export default function TaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId: projectIdStr, taskId: taskIdStr } = use(params);
  const projectId = parseInt(projectIdStr);
  const taskId = parseInt(taskIdStr);

  const { data: revisions } = useQuery({
    queryKey: ["tasks", projectId, "tasks", taskId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/projects/${projectId}/tasks/${taskId}/revisions`,
      );
      return response.json();
    },
  });

  return (
    <div className="size-full">
      <pre>{JSON.stringify(revisions, null, 2)}</pre>
      <Form
        action={async (formData) => {
          await fetch(
            `/api/v1/projects/${projectId}/tasks/${taskId}/revisions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt: formData.get("prompt") as string,
              }),
            },
          );
        }}
      >
        <Textarea name="prompt" placeholder="Prompt..."></Textarea>
        <Button type="submit">Submit</Button>
      </Form>
    </div>
  );
}
