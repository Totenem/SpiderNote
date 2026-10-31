import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  listNotes,
  listNotebooks,
  type Note,
  type Notebook,
} from "@/db/repository";
import { errorMessage } from "@/utils/format";
export function useNotes(query = "", filter = "all", notebook?: string) {
  const db = useSQLiteContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listNotes(db, query, filter, notebook), listNotebooks(db)])
        .then(([items, books]) => {
          if (active) {
            setNotes(items);
            setNotebooks(books);
            setError("");
            setLoading(false);
          }
        })
        .catch((error) => {
          if (active) {
            setError(errorMessage(error));
            setLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [db, query, filter, notebook]),
  );
  return { notes, notebooks, error, loading };
}
