"use client";

import { CheckIcon } from "lucide-react";
import Form from "next/form";
import { useState } from "react";
import {
  type OpenaiUser,
  setOpenaiApiKey,
  validateOpenaiApiKey,
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

export function OpenaiApiKeySetup({
  tokenErased,
  tokenExists,
  initialValidationResult,
}: {
  tokenExists: boolean;
  tokenErased?: string;
  initialValidationResult: OpenaiUser | string | null;
}) {
  const [token, setToken] = useState<string>("");
  const [validatedResult, setValidatedResult] = useState<
    OpenaiUser | string | null
  >(initialValidationResult);

  return (
    <Form
      className="space-y-2"
      action={async (formData) => {
        const result = await setOpenaiApiKey(formData);
        setValidatedResult(result);
        if (typeof result !== "string") {
          setToken("");
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="openai_api_key">OpenAI API Key</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="openai_api_key"
              name="openai_api_key"
              type="password"
              placeholder={
                tokenExists ? (tokenErased ?? "Already set") : "OPENAI_API_KEY"
              }
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={async () => {
                  const openaiUser = await validateOpenaiApiKey(token);
                  setValidatedResult(openaiUser);
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
              Openai Token is validated as login {validatedResult.name}.
            </FieldDescription>
          )}
          {!tokenExists && <FieldError>OpenAI API Key is not set.</FieldError>}
        </Field>
      </FieldGroup>
      <Button type="submit">Save</Button>
    </Form>
  );
}
