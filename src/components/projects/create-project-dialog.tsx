"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { VercelTeamSelect } from "@/components/vercel-team-select";
import { getErrorMessage, handleFetchResponseError } from "@/lib/errors";
import type { DialogProps } from "@radix-ui/react-dialog";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

const requestSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-z]([a-z0-9-_\s]*$)/i,
      "Must start with a letter, followed by letters, numbers, dashes, or underscores.",
    ),
  description: z.string(),
  vercel_team_id: z.string(),
});

export function CreateProjectDialog({ children, ...props }: DialogProps) {
  const [transitioning, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm({
    validators: {
      onSubmit: requestSchema,
    },
    defaultValues: {
      name: "",
      description: "",
      vercel_team_id: null as string | null,
    },
    onSubmit({ value }) {
      startTransition(async () => {
        await fetch("/api/v1/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        })
          .then(handleFetchResponseError)
          .then((res) =>
            res.json().then((project) => {
              props.onOpenChange?.(false);
              startTransition(() => {
                router.push(`/projects/${project.id}`);
              });
            }),
          )
          .catch((err: unknown) => {
            toast.error(`Failed to create project.`, {
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
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <form
          id="create_project"
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
                    <FieldLabel htmlFor="create_project_name">
                      Project Name
                    </FieldLabel>
                    <Input
                      id="create_project_name"
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
              <form.Field name="description">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="create_project_description">
                      Project Description
                    </FieldLabel>
                    <Textarea
                      id="create_project_description"
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
              <form.Field name="vercel_team_id">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="create_project_vercel_team_id">
                      Vercel Team
                    </FieldLabel>
                    <VercelTeamSelect
                      id="create_project_vercel_team_id"
                      name={field.name}
                      teamId={field.state.value}
                      onTeamIdChange={field.handleChange}
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
            </FieldGroup>
          </FieldSet>
        </form>
        <DialogFooter>
          <Button form="create_project" type="submit" disabled={transitioning}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
