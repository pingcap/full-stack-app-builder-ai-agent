export async function handleVercelApiCallError(
  response: Response | Promise<Response>,
) {
  response = await response;
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response;
}
