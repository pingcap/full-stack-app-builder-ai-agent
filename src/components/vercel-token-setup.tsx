"use client";

import { setVercelToken, validateVercelToken } from "@/actions/user-settings";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { AuthUser } from "@vercel/sdk/models/authuser";
import type { AuthUserLimited } from "@vercel/sdk/models/authuserlimited";
import { CheckIcon } from "lucide-react";
import Form from "next/form";
import { useState } from "react";

export function VercelTokenSetup({
  tokenErased,
  tokenExists,
  initialValidationResult,
}: {
  tokenExists: boolean;
  tokenErased?: string;
  initialValidationResult: AuthUser | AuthUserLimited | string | null;
}) {
  const [token, setToken] = useState<string>("");
  const [validatedResult, setValidatedResult] = useState<
    AuthUser | AuthUserLimited | string | null
  >(initialValidationResult);

  return (
    <Form
      className="space-y-2"
      action={async (formData) => {
        const result = await setVercelToken(formData);
        setValidatedResult(result);
        if (typeof result !== "string") {
          setToken("");
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="vercel_token">Vercel Token</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="vercel_token"
              name="vercel_token"
              type="password"
              placeholder={
                tokenExists ? (tokenErased ?? "Already set") : "VERCEL_TOKEN"
              }
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={async () => {
                  const vercelUser = await validateVercelToken(token);
                  setValidatedResult(vercelUser);
                }}
              >
                Validate
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {validatedResult && typeof validatedResult === "string" && (
            <FieldError>{validatedResult}</FieldError>
          )}
          {validatedResult && typeof validatedResult === "object" && (
            <FieldDescription className="text-green-500">
              <CheckIcon className="inline-flex size-4 mr-2" />
              Vercel Token is validated as login {validatedResult.username}.
            </FieldDescription>
          )}
          {!tokenExists && <FieldError>Vercel Token is not set.</FieldError>}
        </Field>
      </FieldGroup>
      <Button type="submit">Save</Button>
    </Form>
  );
}
