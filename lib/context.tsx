import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useColorScheme } from "react-native";
import { Repository } from "./repository";
import { openDriver } from "./driver";
import { light, dark, Theme } from "./theme";
export type Page =
  | "dashboard"
  | "sales"
  | "purchases"
  | "accounts"
  | "inventory"
  | "transactions"
  | "reports"
  | "expenses"
  | "payments"
  | "settings"
  | "more";
export type Sheet = {
  type:
    | "invoice"
    | "party"
    | "money"
    | "detail"
    | "partyDetail"
    | "search"
    | "notifications"
    | "help"
    | "license"
    | "type";
  kind?: string;
  id?: string;
  partyId?: string;
} | null;
type ContextType = {
  repo: Repository | null;
  revision: number;
  refresh: () => void;
  theme: Theme;
  settings: Record<string, string>;
  page: Page;
  setPage: (p: Page) => void;
  sheet: Sheet;
  open: (s: Sheet) => void;
  toast: string;
  notify: (s: string) => void;
  error: string;
  reload: () => void;
};
const Context = createContext<ContextType>(null as any);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<Page>("dashboard");
  const [sheet, open] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const scheme = useColorScheme();
  useEffect(() => {
    let alive = true;
    setError("");
    openDriver()
      .then(async (db) => {
        const r = new Repository(db);
        await r.initialize();
        if (alive) setRepo(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);
  const settings = repo?.settings() || {};
  const mode = settings.theme || "light";
  const theme =
    mode === "dark" || (mode === "system" && scheme === "dark") ? dark : light;
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  return (
    <Context.Provider
      value={{
        repo,
        revision,
        refresh,
        theme,
        settings,
        page,
        setPage,
        sheet,
        open,
        toast,
        notify: setToast,
        error,
        reload: () => setRetry((r) => r + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
