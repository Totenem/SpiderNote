import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useAccount } from "@/features/account/provider";
import { Button, Notice } from "./kit";
import { ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";
export function AccountCard() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true);
    try {
      await account.signIn();
      setError("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>
        {account.signedIn ? account.name : "Your account"}
      </Text>
      {account.signedIn ? (
        <>
          <Text style={ui.body}>{account.email}</Text>
          <Text style={ui.heading}>
            {account.access?.plan === "pro"
              ? "SpiderNote Pro"
              : account.access
                ? "Free plan"
                : "Plan unavailable"}
          </Text>
          <Button label="Refresh plan" secondary onPress={account.refresh} />
          <Button
            label="Sign out"
            secondary
            onPress={() =>
              Alert.alert(
                "Sign out?",
                "Your notes and recordings will stay on this device.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    onPress: () =>
                      account
                        .signOut()
                        .catch((error) => setError(errorMessage(error))),
                  },
                ],
              )
            }
          />
        </>
      ) : (
        <>
          <Text style={ui.body}>
            Sign in for Pro AI notes. Your local library works without an
            account.
          </Text>
          <Button
            label="Sign in or create an account"
            onPress={signIn}
            busy={busy}
            disabled={account.loading}
          />
        </>
      )}
      {!!(error || account.error) && (
        <Notice error>{error || account.error}</Notice>
      )}
    </View>
  );
}
