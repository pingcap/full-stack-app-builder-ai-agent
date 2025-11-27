"use client";

import {
  type GithubUserResponse,
  setGithubToken,
  validateGitHubToken,
} from "@/actions/user-settings";
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
import { CheckIcon } from "lucide-react";
import Form from "next/form";
import { useState } from "react";

export function GithubAccountSettings({
  tokenExists,
  tokenErased,
  initialValidationResult,
}: {
  tokenExists: boolean;
  tokenErased?: string;
  initialValidationResult: GithubUserResponse | string | null;
}) {
  const [token, setToken] = useState<string>("");
  const [validatedResult, setValidatedResult] = useState<
    GithubUserResponse | string | null
  >(initialValidationResult);

  return (
    <Form
      action={async (formData) => {
        const result = await setGithubToken(formData);
        setValidatedResult(result);
        if (typeof result !== "string") {
          setToken("");
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="github_token">GitHub Token</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="github_token"
              name="github_token"
              type="password"
              placeholder={
                tokenExists ? (tokenErased ?? "Already set") : "GITHUB_TOKEN"
              }
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={async () => {
                  const githubUser = await validateGitHubToken(token);
                  setValidatedResult(githubUser);
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
              GitHub Token is validated as login {validatedResult.login}.
            </FieldDescription>
          )}
          {!tokenExists && <FieldError>GitHub Token is not set.</FieldError>}
        </Field>
        <Button type="submit">Submit</Button>
      </FieldGroup>
    </Form>
  );
}
