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
  const [revision, setRevision] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = revision >= 0;
      listNotes(db, query, filter, notebook)
        .then((items) => {
          if (active) {
            setNotes(items);
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
    }, [db, query, filter, notebook, revision]),
  );
  useFocusEffect(
    useCallback(() => {
      let active = revision >= 0;
      listNotebooks(db)
        .then((books) => {
          if (active) setNotebooks(books);
        })
        .catch((error) => {
          if (active) setError(errorMessage(error));
        });
      return () => {
        active = false;
      };
    }, [db, revision]),
  );
  return {
    notes,
    notebooks,
    error,
    loading,
    refresh: () => setRevision((value) => value + 1),
  };
}
