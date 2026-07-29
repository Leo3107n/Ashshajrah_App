import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import api, { ApiError, onUnauthorized } from "../api";
import { normalizeRole } from "../navigation/roleNavigation";

const AuthContext = createContext(null);

export const ROLE_HOME_ROUTES = Object.freeze({
  superadmin: "/(app)/superadmin/dashboard",
  admin: "/(app)/admin/dashboard",
  coordinator: "/(app)/coordinator/dashboard",
  teacher: "/(app)/teacher/dashboard",
  parent: "/(app)/parent/dashboard",
  student: "/(app)/student/dashboard",
});

function userFromSession(session) {
  return session?.user || null;
}

export function getRoleHomeRoute(role) {
  return ROLE_HOME_ROUTES[normalizeRole(role)] || "/(auth)/login";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const mountedRef = useRef(true);
  const refreshPromiseRef = useRef(null);

  const clearSession = useCallback(() => {
    if (!mountedRef.current) return;
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async ({ silent = false } = {}) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    if (!silent && mountedRef.current) {
      setStatus((current) =>
        current === "authenticated" ? current : "loading"
      );
    }

    const refreshPromise = api.auth
      .restoreCookies()
      .then(() => api.auth.session())
      .then((nextSession) => {
        if (!mountedRef.current) return nextSession;

        if (userFromSession(nextSession)) {
          setSession(nextSession);
          setStatus("authenticated");
          setError(null);
        } else {
          setSession(null);
          setStatus("unauthenticated");
        }

        return nextSession;
      })
      .catch((nextError) => {
        if (!mountedRef.current) return null;

        setSession(null);
        setStatus("unauthenticated");
        if (!silent) setError(nextError);
        // Session restoration is a background operation. A temporarily
        // unavailable backend should return the user to login, not surface an
        // unhandled promise/LogBox error. Explicit login still throws normally.
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  const login = useCallback(async ({ identifier, password }) => {
    const cleanIdentifier = String(identifier || "").trim();

    if (!cleanIdentifier) {
      throw new ApiError("Email, phone, or username is required.", {
        code: "MISSING_IDENTIFIER",
      });
    }

    if (!String(password || "").trim()) {
      throw new ApiError("Password is required.", {
        code: "MISSING_PASSWORD",
      });
    }

    if (mountedRef.current) {
      setStatus("authenticating");
      setError(null);
    }

    try {
      const nextSession = await api.auth.signIn({
        identifier: cleanIdentifier,
        password: String(password),
      });

      if (mountedRef.current) {
        setSession(nextSession);
        setStatus("authenticated");
        setNotice("");
      }

      return {
        session: nextSession,
        user: userFromSession(nextSession),
        role: normalizeRole(nextSession?.user?.role),
        route: getRoleHomeRoute(nextSession?.user?.role),
      };
    } catch (nextError) {
      if (mountedRef.current) {
        setSession(null);
        setStatus("unauthenticated");
        setError(nextError);
      }
      throw nextError;
    }
  }, []);

  const logout = useCallback(async () => {
    if (mountedRef.current) {
      setStatus("authenticating");
      setError(null);
    }

    try {
      await api.auth.signOut();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const clearError = useCallback(() => setError(null), []);
  const clearNotice = useCallback(() => setNotice(""), []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = onUnauthorized(() => {
      setNotice("Your session expired. Please sign in again.");
      clearSession();
    });

    refreshSession().catch(() => {
      // State and the user-facing error are already set by refreshSession.
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [clearSession, refreshSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && status === "authenticated") {
        refreshSession({ silent: true }).catch(() => {
          // A failed foreground refresh clears stale authentication state.
        });
      }
    });

    return () => subscription.remove();
  }, [refreshSession, status]);

  const user = userFromSession(session);
  const role = normalizeRole(user?.role);

  const value = useMemo(
    () => ({
      session,
      user,
      role,
      status,
      error,
      notice,
      isLoading: status === "loading",
      isAuthenticating: status === "authenticating",
      isAuthenticated: status === "authenticated" && Boolean(user),
      homeRoute: getRoleHomeRoute(role),
      login,
      logout,
      refreshSession,
      clearError,
      clearNotice,
    }),
    [
      session,
      user,
      role,
      status,
      error,
      notice,
      login,
      logout,
      refreshSession,
      clearError,
      clearNotice,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

export default AuthContext;
