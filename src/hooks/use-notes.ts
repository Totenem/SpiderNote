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
    }, [db, query, filter, notebook]),
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
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
    }, [db]),
  );
  return { notes, notebooks, error, loading };
}
