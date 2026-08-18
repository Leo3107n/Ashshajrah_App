import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { getUserRoleNames } from "@/lib/userRoles";

export const roleToDashboard = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  coordinator: "/coordinator/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  student: "/student/dashboard",
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value) {
  const trimmed = clean(value);
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\s+/g, "").replace(/[-()]/g, "");
}

function toAuthError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function findAuthUser(rawIdentifier) {
  // Step 1 of authentication: find the base user record from any supported
  // identifier format. Multi-role selection happens later, after credentials
  // are validated and the full live role list is loaded for this user.
  const isEmail = rawIdentifier.includes("@");
  const phoneIdentifier = rawIdentifier.replace(/\D/g, "");
  const normalizedUsername = normalizeIdentifier(rawIdentifier).toLowerCase();

  let whereCondition;

  if (isEmail) {
    whereCondition = Prisma.sql`
      LOWER(TRIM(COALESCE(u.email, ''))) = LOWER(TRIM(${rawIdentifier}))
    `;
  } else if (phoneIdentifier.length >= 7) {
    whereCondition = Prisma.sql`
      (
        REGEXP_REPLACE(COALESCE(u.phone, ''), '\\D', '', 'g') = ${phoneIdentifier}
        OR LOWER(TRIM(COALESCE(u.username, ''))) = LOWER(TRIM(${normalizedUsername}))
      )
    `;
  } else if (normalizedUsername) {
    whereCondition = Prisma.sql`
      LOWER(TRIM(COALESCE(u.username, ''))) = LOWER(TRIM(${normalizedUsername}))
    `;
  } else {
    return null;
  }

  const users = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        u.id::text AS id,
        u.full_name,
        u.username,
        u.email,
        u.phone,
        u.password_hash,
        u.status::text AS status,
        r.name AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE ${whereCondition}
      LIMIT 1
    `
  );

  return users?.[0] || null;
}

export async function validateUserCredentials(rawIdentifier, password) {
  // This helper is intentionally shared by both:
  // - the credentials sign-in flow
  // - the /api/auth/role-options pre-check route
  //
  // That keeps password validation, active-status checks, and role discovery
  // identical across web and mobile before we decide whether to show a
  // role-selection modal or continue directly into a single portal.
  const user = await findAuthUser(clean(rawIdentifier));

  if (!user) {
    return null;
  }

  if (String(user.status || "").toLowerCase() !== "active") {
    return null;
  }

  if (!user.password_hash) {
    return null;
  }

  const storedPassword = String(user.password_hash || "");
  const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);
  const passwordMatches = isBcryptHash
    ? await bcrypt.compare(password, storedPassword)
    : password === storedPassword;

  if (!passwordMatches) {
    return null;
  }

  const roles = await getUserRoleNames(user.id);
  const fallbackRole = String(user.role_name || "").trim().toLowerCase();
  const uniqueRoles = [...new Set([...(roles || []), fallbackRole].filter(Boolean))].filter(
    (role) => roleToDashboard[role]
  );

  return {
    id: user.id,
    full_name: user.full_name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    status: user.status,
    roles: uniqueRoles,
    defaultRole: uniqueRoles[0] || fallbackRole,
  };
}

function normalizeAllowedRoles(roles, fallbackRole = "") {
  // During the migration from the legacy single-role users.role_id model to
  // multi-role user_roles mappings, different environments may expose role
  // data from slightly different sources. This helper gives auth one
  // consistent "allowed roles + default role" shape everywhere.
  const uniqueRoles = [...new Set([...(roles || []), fallbackRole].filter(Boolean))].filter(
    (role) => roleToDashboard[role]
  );

  return {
    roles: uniqueRoles,
    defaultRole: uniqueRoles[0] || "",
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // The actual sign-in step always creates a session for exactly one
        // selected portal role. If the client already asked the user to choose
        // a role, selectedRole is honored only when it still belongs to the
        // user. Otherwise we fall back to the current default role safely.
        const rawIdentifier = clean(credentials?.identifier);
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const selectedRole = clean(credentials?.selectedRole).toLowerCase();

        if (!rawIdentifier) {
          throw toAuthError("missing_identifier");
        }

        if (!password.trim()) {
          throw toAuthError("missing_password");
        }

        const user = await validateUserCredentials(rawIdentifier, password);

        if (!user) {
          return null;
        }

        const { roles, defaultRole } = normalizeAllowedRoles(user.roles, user.defaultRole);
        const role = selectedRole && roles.includes(selectedRole) ? selectedRole : defaultRole;

        if (!roleToDashboard[role]) {
          return null;
        }

        return {
          id: user.id,
          full_name: user.full_name || "",
          name: user.full_name || "",
          username: user.username || "",
          email: user.email || "",
          phone: user.phone || "",
          role,
          status: user.status,
          roles,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.full_name = user.full_name || "";
        token.name = user.full_name || "";
        token.username = user.username || "";
        token.email = user.email || "";
        token.role = user.role;
        token.roles = user.roles || [user.role].filter(Boolean);
        token.status = user.status;
        token.phone = user.phone || "";
      }

      return token;
    },
    async session({ session, token }) {
      // Session reads are revalidated against the live database role mapping so
      // stale cookies cannot keep a removed role forever. If the previously
      // selected role no longer exists, the session falls back to the first
      // still-valid role. The mobile app then uses session.user.role as the
      // single active portal for that restored session.
      const liveRoles = token.userId ? await getUserRoleNames(token.userId) : [];
      const { roles: normalizedLiveRoles, defaultRole } = normalizeAllowedRoles(
        liveRoles,
        String(token.role || "").toLowerCase()
      );
      const liveRoleSet = new Set(normalizedLiveRoles);
      const selectedRole = String(token.role || "").toLowerCase();

      if (session.user) {
        session.user.id = token.userId;
        session.user.full_name = token.full_name || "";
        session.user.name = token.name || token.full_name || "";
        session.user.username = token.username || "";
        session.user.email = token.email;
        session.user.role = liveRoleSet.has(selectedRole)
          ? selectedRole
          : defaultRole;
        session.user.roles = normalizedLiveRoles;
        session.user.status = token.status;
        session.user.phone = token.phone;
      }

      return session;
    },
  },
});
