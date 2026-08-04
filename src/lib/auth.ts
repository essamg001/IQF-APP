import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, Station } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      isHeadOfSales: boolean;
      isHeadOfProduction: boolean;
      station: Station | null;
    };
  }
  interface User {
    role: Role;
    isHeadOfSales: boolean;
    isHeadOfProduction: boolean;
    station: Station | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isHeadOfSales: user.isHeadOfSales,
          isHeadOfProduction: user.isHeadOfProduction,
          station: user.station,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isHeadOfSales = user.isHeadOfSales;
        token.isHeadOfProduction = user.isHeadOfProduction;
        token.station = user.station;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.isHeadOfSales = token.isHeadOfSales as boolean;
        session.user.isHeadOfProduction = token.isHeadOfProduction as boolean;
        session.user.station = (token.station as Station | null) ?? null;
      }
      return session;
    },
  },
});
