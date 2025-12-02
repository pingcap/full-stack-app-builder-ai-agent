"use client";

import { setVercelBlobStorage } from "@/actions/user-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VercelTeamSelect } from "@/components/vercel-team-select";
import type { VercelBlobStorageDetails } from "@/lib/vercel/blobs";
import { useQuery } from "@tanstack/react-query";
import Form from "next/form";
import { useState } from "react";

export function VercelBlobStorageSetup({
  vercelBlobId,
  vercelBlobTeamId,
  enabled,
}: {
  vercelBlobTeamId?: string;
  vercelBlobId?: string;
  enabled: boolean;
}) {
  const [teamId, setTeamId] = useState<string | undefined>(vercelBlobTeamId);
  const [blobId, setBlobId] = useState<string | undefined>(vercelBlobId);

  const canSave = teamId && blobId;

  const {
    data: blobs,
    isEnabled: isBlobEnabled,
    isLoading: isBlobLoading,
    error: blobsError,
  } = useQuery<VercelBlobStorageDetails[]>({
    queryKey: [`teams.${teamId}.blobs`],
    enabled: enabled && !!teamId,
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/vercel/teams/${encodeURIComponent(teamId!)}/storages/blobs`,
      );
      return response.json();
    },
  });

  return (
    <Form
      action={async (formData) => {
        await setVercelBlobStorage(formData);
      }}
    >
      <FieldSet>
        <FieldTitle>Vercel Blob</FieldTitle>
        <FieldDescription>
          Vercel blob is used to store coding agent session history.
        </FieldDescription>
        <FieldGroup className="grid grid-cols-12">
          <Field className="col-span-2">
            <VercelTeamSelect
              name="vercel_blob_team_id"
              teamId={teamId}
              onTeamIdChange={setTeamId}
              enabled={enabled}
            />
          </Field>
          <Field className="col-span-8">
            <Select
              name="vercel_blob_storage_id"
              value={blobId ?? ""}
              onValueChange={setBlobId}
              disabled={
                !enabled || isBlobLoading || !!blobsError || !isBlobEnabled
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a blob" />
              </SelectTrigger>
              <SelectContent>
                {blobs?.map((blob) => (
                  <SelectItem key={blob.id} value={blob.id}>
                    <Badge variant="outline">{blob.status}</Badge>
                    {blob.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button className="col-span-2" type="submit" disabled={!canSave}>
            Save
          </Button>
        </FieldGroup>
      </FieldSet>
    </Form>
  );
}
