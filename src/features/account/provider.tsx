import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { accountRequest } from "./api";
type Access = { plan: "free" | "pro"; source: string };
type Account = {
  available: boolean;
  signedIn: boolean;
  loading: boolean;
  name: string;
  email: string;
  userId: string | null;
  access: Access | null;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  getToken: () => Promise<string | null>;
};
const unavailable = async () => {
  throw Error(
    "Sign-in is temporarily unavailable. Your local notes are still available.",
  );
};
const guest: Account = {
  available: false,
  signedIn: false,
  loading: false,
  name: "Your account",
  email: "",
  userId: null,
  access: null,
  error: "",
  signIn: unavailable,
  signOut: async () => {},
  refresh: async () => {},
  getToken: async () => null,
};
const Context = createContext<Account>(guest);
export const useAccount = () => useContext(Context);
function Session({ children }: PropsWithChildren) {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const { startHostedAuth } = useHostedAuth();
  const [access, setAccess] = useState<(Access & { userId: string }) | null>(
    null,
  );
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const result = await accountRequest("/api/account", token);
      if (result.userId !== userId) return;
      setAccess({
        plan: result.plan,
        source: result.source,
        userId: result.userId,
      });
      setError("");
    } catch {
      setAccess(null);
      setError("Could not refresh your plan. Connect and try again.");
    }
  }, [getToken, isSignedIn, userId]);
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    getToken()
      .then((token) => (token ? accountRequest("/api/account", token) : null))
      .then((result) => {
        if (active && result?.userId === userId) {
          setAccess({
            plan: result.plan,
            source: result.source,
            userId: result.userId,
          });
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setAccess(null);
          setError("Could not refresh your plan. Connect and try again.");
        }
      });
    return () => {
      active = false;
    };
  }, [getToken, isSignedIn, userId]);
  const value = useMemo<Account>(
    () => ({
      available: true,
      signedIn: !!isSignedIn,
      loading: !isLoaded,
      name:
        user?.fullName ||
        user?.primaryEmailAddress?.emailAddress ||
        "Your account",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
      userId: userId ?? null,
      access: isSignedIn && access?.userId === userId ? access : null,
      error,
      signIn: async () => {
        await startHostedAuth({ mode: "sign-in" });
      },
      signOut: async () => {
        setAccess(null);
        setError("");
        await clerk.signOut();
      },
      refresh,
      getToken: () => getToken(),
    }),
    [
      isSignedIn,
      isLoaded,
      user,
      userId,
      access,
      error,
      startHostedAuth,
      clerk,
      refresh,
      getToken,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function AccountProvider({ children }: PropsWithChildren) {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key)
    return <Context.Provider value={guest}>{children}</Context.Provider>;
  return (
    <ClerkProvider
      publishableKey={key}
      tokenCache={tokenCache}
      telemetry={false}
    >
      <Session>{children}</Session>
    </ClerkProvider>
  );
}
