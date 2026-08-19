import { createContext, useContext } from "react";

/**
 * The context object and its helpers live apart from the provider component
 * so that the provider file exports a component and nothing else - which is
 * what React Fast Refresh needs to hot-reload it correctly.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return context;
}

/** Where a given role belongs when it has nowhere better to go. */
export function homeFor(role) {
  return role === "DOCTOR" ? "/doctor/dashboard" : "/patient/dashboard";
}

export function loginFor(role) {
  return role === "DOCTOR" ? "/doctor/login" : "/patient/login";
}
