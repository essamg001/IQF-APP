import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, Station, Locale } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      isHeadOfSales: boolean;
      isHeadOfProduction: boolean;
      isHeadOfMaintenance: boolean;
      isHeadOfPurchasing: boolean;
      isStoreSupervisor: boolean;
      isHeadOfAccounting: boolean;
      financialsRestricted: boolean;
      station: Station | null;
      locale: Locale;
    };
  }
  interface User {
    role: Role;
    isHeadOfSales: boolean;
    isHeadOfProduction: boolean;
    isHeadOfMaintenance: boolean;
    isHeadOfPurchasing: boolean;
    isStoreSupervisor: boolean;
    isHeadOfAccounting: boolean;
    financialsRestricted: boolean;
    station: Station | null;
    locale: Locale;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const identifier = credentials?.identifier as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!identifier || !password) return null;

        const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
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
          isHeadOfMaintenance: user.isHeadOfMaintenance,
          isHeadOfPurchasing: user.isHeadOfPurchasing,
          isStoreSupervisor: user.isStoreSupervisor,
          isHeadOfAccounting: user.isHeadOfAccounting,
          financialsRestricted: user.financialsRestricted,
          station: user.station,
          locale: user.locale,
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
        token.isHeadOfMaintenance = user.isHeadOfMaintenance;
        token.isHeadOfPurchasing = user.isHeadOfPurchasing;
        token.isStoreSupervisor = user.isStoreSupervisor;
        token.isHeadOfAccounting = user.isHeadOfAccounting;
        token.financialsRestricted = user.financialsRestricted;
        token.station = user.station;
        token.locale = user.locale;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.isHeadOfSales = token.isHeadOfSales as boolean;
        session.user.isHeadOfProduction = token.isHeadOfProduction as boolean;
        session.user.isHeadOfMaintenance = token.isHeadOfMaintenance as boolean;
        session.user.isHeadOfPurchasing = token.isHeadOfPurchasing as boolean;
        session.user.isStoreSupervisor = token.isStoreSupervisor as boolean;
        session.user.isHeadOfAccounting = token.isHeadOfAccounting as boolean;
        session.user.financialsRestricted = (token.financialsRestricted as boolean) ?? false;
        session.user.station = (token.station as Station | null) ?? null;
        session.user.locale = (token.locale as Locale) ?? "EN";
      }
      return session;
    },
  },
});
