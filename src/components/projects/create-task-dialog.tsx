"use client";

import type { DialogProps } from "@radix-ui/react-dialog";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { GithubRepoBranchSelect } from "@/components/github-repo-branch-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorMessage, handleFetchResponseError } from "@/lib/errors";

const requestSchema = z.object({
  name: z.string(),
  base_branch: z.string(),
  target_branch: z.string(),
});

export function CreateTaskDialog({
  projectId,
  children,
  ...props
}: DialogProps & { projectId: number }) {
  const [transitioning, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm({
    validators: {
      onSubmit: requestSchema,
    },
    defaultValues: {
      name: "",
      base_branch: "main",
      target_branch: "",
    },
    onSubmit({ value }) {
      startTransition(async () => {
        await fetch(`/api/v1/projects/${projectId}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        })
          .then(handleFetchResponseError)
          .then((res) => {
            res.json().then((task) => {
              props.onOpenChange?.(false);
              startTransition(() => {
                router.push(`/projects/${projectId}/tasks/${task.id}`);
              });
            });
          })
          .catch((err) => {
            toast.error(`Failed to create task.`, {
              description: getErrorMessage(err),
            });
          });
      });
    },
  });

  return (
    <Dialog {...props}>
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new task</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <form
          id="create_task"
          onSubmit={(ev) => {
            ev.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldSet>
            <FieldGroup>
              <form.Field name="name">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="create_task_name">
                      Task Name
                    </FieldLabel>
                    <Input
                      id="create_task_name"
                      name={field.name}
                      value={field.state.value}
                      onChange={(ev) => field.handleChange(ev.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]!.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              </form.Field>
              <form.Field name="base_branch">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="create_task_base_branch">
                      Base Branch
                    </FieldLabel>
                    <GithubRepoBranchSelect
                      id="create_task_base_branch"
                      projectId={projectId}
                      name={field.name}
                      branch={field.state.value}
                      onBranchChange={field.handleChange}
                      onBlur={field.handleBlur}
                      enabled
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]!.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              </form.Field>
              <form.Field name="target_branch">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="create_task_target_branch">
                      Target Branch
                    </FieldLabel>
                    <Input
                      id="create_task_target_branch"
                      name={field.name}
                      value={field.state.value}
                      onChange={(ev) => field.handleChange(ev.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]!.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </FieldSet>
        </form>
        <DialogFooter>
          <Button form="create_task" type="submit" disabled={transitioning}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
