import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";
import { createNote } from "@/db/repository";
import { errorMessage } from "@/utils/format";
export function useCreateNote() {
  const db = useSQLiteContext();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const id = randomUUID();
      await createNote(db, id);
      router.push({ pathname: "/note/[id]", params: { id } });
    } catch (error) {
      Alert.alert("Could not create note", errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { create, busy };
}
