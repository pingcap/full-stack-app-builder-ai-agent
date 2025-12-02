import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { get, omit } from "@/lib/kysely-utils";
import { compare } from "bcrypt";
import type { Selectable } from "kysely";
import { type AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const GOOGLE_ALLOWED_DOMAIN =
  process.env.GOOGLE_ALLOWED_DOMAIN?.toLowerCase();

declare module "next-auth" {
  interface Session {
    user: Omit<Selectable<DB["user"]>, "password">;
  }
}

const providers: AuthOptions["providers"] = [
  Credentials({
    credentials: {
      username: { label: "Username", type: "text", placeholder: "jsmith" },
      password: { label: "Password", type: "password" },
    },

    async authorize(credentials, req) {
      if (!credentials) {
        return null;
      }

      const dbUser = await get(db, "user", (eb) =>
        eb.and([eb("name", "=", credentials.username)]),
      );

      if (await compare(credentials.password, dbUser.password)) {
        return {
          id: `db|${dbUser.id}`,
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.avatar_url,
          dbUser: omit(dbUser, ["password"]),
        };
      }

      return null;
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export default {
  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/login",
  },
  providers,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "google") {
        const email =
          (user?.email ?? (profile as { email?: string } | null)?.email ?? "")
            .toLowerCase();
        if (
          GOOGLE_ALLOWED_DOMAIN &&
          !email.endsWith(GOOGLE_ALLOWED_DOMAIN)
        ) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, trigger, user, session }) {
      if (trigger === "signIn" || trigger === "signUp") {
        if ((user as any).dbUser) {
          token.user = (user as any).dbUser;
        }
        if (user.id.startsWith("db|")) {
          const id = parseInt(user.id.replace(/^db\|/, ""));
          token.user = omit(await get(db, "user", { id }), ["password"]);
        }
      }
      return token;
    },
    session: async ({ session, token, user }) => {
      if (token.user) {
        session.user = token.user as any;
      } else if (user && user.id.startsWith("db|")) {
        const id = parseInt(user.id.replace(/^db\|/, ""));
        session.user = omit(await get(db, "user", { id }), ["password"]);
      }

      return session;
    },
  },
} satisfies AuthOptions;
