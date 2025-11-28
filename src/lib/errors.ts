import { HTTPClientError } from "@vercel/sdk/models/httpclienterrors";
import { SDKValidationError } from "@vercel/sdk/models/sdkvalidationerror";
import { VercelError } from "@vercel/sdk/models/vercelerror";

export class ResponseError extends Error {
  readonly response: Response;

  constructor(response: Response, message: string) {
    super(message);
    this.response = response;
  }
}

export async function handleFetchResponseError(
  response: Response | Promise<Response>,
) {
  response = await response;

  if (response.ok) {
    return response;
  }

  try {
    const jsonResponse = await response.clone().json();
    return Promise.reject(
      new ResponseError(response.clone(), getErrorMessage(jsonResponse)),
    );
  } catch {
    try {
      const textResponse = await response.clone().text();
      return Promise.reject(
        new ResponseError(
          response.clone(),
          `${response.status} ${textResponse}`,
        ),
      );
    } catch {
      return Promise.reject(
        new ResponseError(
          response.clone(),
          `${response.status} ${response.statusText}`,
        ),
      );
    }
  }
}

export function getErrorMessage(error: unknown): string {
  if (error == null) {
    return "Unknown error";
  }
  if (typeof error === "object") {
    if (error instanceof VercelError) {
      return `${error.name}: ${error.statusCode} ${error.message}`;
    }

    if (error instanceof HTTPClientError) {
      return `${error.name}: ${error.message}`;
    }

    if (error instanceof SDKValidationError) {
      return `${error.name}: ${error.pretty()}`;
    }

    return String(
      getErrorMessage((error as Record<string, unknown>).message) ??
        JSON.stringify(error),
    );
  }
  return String(error);
}
