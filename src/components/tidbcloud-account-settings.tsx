"use client";

import { setTidbCloudAccessKey } from "@/actions/user-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AccessKeyInfo } from "@/lib/tidbcloud/sdk";
import Form from "next/form";
import { useState } from "react";

export function TidbCloudAccountSettings({
  privateKeyErased,
  publicKeyErased,
  initialInfo,
  orgId,
  projectId,
}: {
  publicKeyErased?: string;
  privateKeyErased?: string;
  initialInfo?: AccessKeyInfo | string;
  orgId: string | null | undefined;
  projectId: string | null | undefined;
}) {
  const [result, setResult] = useState<AccessKeyInfo | string | undefined>(
    initialInfo,
  );

  const NAME_REGEX = /^orgs\/(.+)\/projects\/(.+)\/apiKeys\/.+$/;
  const matched =
    typeof result === "object" ? NAME_REGEX.exec(result.name) : null;

  return (
    <Form
      action={async (formData) => {
        const result = await setTidbCloudAccessKey(formData);
        setResult(result);
      }}
    >
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel>Public Key</FieldLabel>
            <Input
              name="tidbcloud_public_key"
              type="password"
              placeholder={publicKeyErased ?? "TIDB_CLOUD_PUBLIC_KEY"}
            />
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field>
            <FieldLabel>Private Key</FieldLabel>
            <Input
              name="tidbcloud_private_key"
              type="password"
              placeholder={privateKeyErased ?? "TIDB_CLOUD_PRIVATE_KEY"}
            />
          </Field>
        </FieldGroup>
        {typeof result === "object" && (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel>Organization ID</FieldLabel>
                <Input
                  readOnly
                  placeholder="Determined by access key"
                  value={orgId || ""}
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel>Project ID</FieldLabel>
                <Input
                  readOnly
                  placeholder="Determined by access key"
                  value={projectId || ""}
                />
              </Field>
            </FieldGroup>
          </>
        )}
        {typeof result === "string" && (
          <Alert variant="destructive">
            <AlertTitle>Invalid access key</AlertTitle>
            <AlertDescription>{result}</AlertDescription>
          </Alert>
        )}
        <Button type="submit">Save</Button>
      </FieldSet>
    </Form>
  );
}
