"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { UserPrincipal } from "@/server/auth/principal";
import { readResponse } from "./ui";
const Context = createContext<{
  principal: UserPrincipal | null;
  loading: boolean;
  error: string;
}>({ principal: null, loading: true, error: "" });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [principal, setPrincipal] = useState<UserPrincipal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(readResponse)
      .then((d) => setPrincipal(d.principal))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <Context.Provider value={{ principal, loading, error }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
