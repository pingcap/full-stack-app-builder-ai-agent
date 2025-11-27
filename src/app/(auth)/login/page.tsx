import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const { error } = (await searchParams) ?? {};
  return (
    <div className="w-screen min-h-screen bg-muted flex flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-sm">
        <LoginForm error={error ? String(error) : undefined} />
      </div>
    </div>
  );
}
