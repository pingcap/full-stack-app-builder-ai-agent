"use client";

import Form from "next/form";
import { useState } from "react";
import {
  setVercelBlobStorage,
  setVercelDefaultProjectTeam,
} from "@/actions/user-settings";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { VercelTeamSelect } from "@/components/vercel-team-select";

export function VercelDefaultProjectTeamSetup({
  defaultVercelTeamId,
  enabled,
}: {
  defaultVercelTeamId?: string;
  enabled: boolean;
}) {
  const [teamId, setTeamId] = useState<string | undefined>(defaultVercelTeamId);

  const canSave = !!teamId;

  return (
    <Form
      action={async (formData) => {
        await setVercelDefaultProjectTeam(formData);
      }}
    >
      <FieldSet>
        <FieldTitle>Default Vercel Project Team</FieldTitle>
        <FieldDescription>
          Your projects will be deployed to this team by default.
        </FieldDescription>
        <FieldGroup className="grid grid-cols-12">
          <Field className="col-span-2">
            <VercelTeamSelect
              name="default_vercel_project_team_id"
              teamId={teamId}
              onTeamIdChange={setTeamId}
              enabled={enabled}
            />
          </Field>
          <Button className="col-span-2" type="submit" disabled={!canSave}>
            Save
          </Button>
        </FieldGroup>
      </FieldSet>
    </Form>
  );
}
