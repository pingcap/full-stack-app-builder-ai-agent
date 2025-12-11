import { compare, hash } from "bcrypt";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { toSessionUser } from "@/lib/auth-common";
import db from "@/lib/db/db";

async function $getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  });
}

export const getSession = cache($getSession);

export async function getSessionUser() {
  const s = await $getSession();

  if (!s) {
    return null;
  }

  return toSessionUser(s.user);
}

const auth = betterAuth({
  database: {
    db,
    type: "mysql",
    casing: "snake",
  },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  plugins: [nextCookies()],

  user: {
    fields: {
      image: "avatar_url",
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "email_verified",
    },
    additionalFields: {
      role: {
        type: "string",
        required: true,
        returned: true,
        input: false,
      },
    },
  },
  session: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      userId: "user_id",
    },
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      userId: "user_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
    password: {
      async hash(password) {
        return hash(password, process.env.BCRYPT_SALT!);
      },
      async verify({ hash, password }) {
        return await compare(password, hash);
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.image) {
            user.image = "";
          }
          return { data: user };
        },
      },
    },
  },
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
  },
} satisfies BetterAuthOptions);

export { auth };
