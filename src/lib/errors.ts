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
    return String(
      getErrorMessage((error as Record<string, unknown>).message) ??
        JSON.stringify(error),
    );
  }
  return String(error);
}
