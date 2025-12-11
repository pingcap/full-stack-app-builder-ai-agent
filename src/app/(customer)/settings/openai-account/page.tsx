import { validateOpenaiApiKey } from "@/actions/user-settings";
import { OpenaiApiKeySetup } from "@/components/openai-api-key-setup";

import { getSiteSettings } from "@/lib/system-settings";

export default async function Page() {
  const settings = await getSiteSettings();
  const result = await validateOpenaiApiKey(undefined);

  return (
    <OpenaiApiKeySetup
      tokenExists={settings?.openai_api_key !== null}
      tokenErased={settings?.openai_api_key?.slice(0, 6).padEnd(12, "*")}
      initialValidationResult={result}
    />
  );
}
