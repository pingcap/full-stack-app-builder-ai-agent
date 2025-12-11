"use client";

import { type ComponentProps, useTransition } from "react";
import { toast } from "sonner";
import { signIn } from "@/actions/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function LoginForm({
  className,
  error,
  callbackUrl,
  ...props
}: ComponentProps<"div"> & { error?: string; callbackUrl?: string }) {
  const [transitioning, startTransition] = useTransition();
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-1">
          <form
            className="p-6 md:p-8"
            action={(formData) => {
              startTransition(async () => {
                await signIn({
                  email: String(formData.get("email")),
                  password: String(formData.get("password")),
                  rememberMe: true,
                  callbackURL: callbackUrl ?? "/",
                });
              });
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your Acme Inc account
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  placeholder="user@example.com"
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" name="password" type="password" required />
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Failed to login</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Field>
                <Button type="submit" disabled={transitioning}>
                  Login
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field className="grid grid-cols-1 gap-4">
                <Button
                  variant="outline"
                  type="button"
                  disabled={transitioning}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await authClient.signIn.social({
                        provider: "google",
                      });
                      if (res.error) {
                        toast.error(getErrorMessage(res.error));
                      } else {
                        if (res.data.redirect) {
                          window.location.href = res.data.url ?? "/";
                        } else {
                          window.location.href = "/";
                        }
                      }
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <title>Google Icon</title>
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Login with PingCAP Account</span>
                </Button>
              </Field>
              {/*<FieldDescription className="text-center">*/}
              {/*  Don&apos;t have an account? <a href="#">Sign up</a>*/}
              {/*</FieldDescription>*/}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
