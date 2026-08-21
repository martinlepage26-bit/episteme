import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  getCoder,
  getSessionId,
  getStance,
  setCoder as persistCoder,
  setSessionId as persistSessionId,
  setStance as persistStance,
} from "./api";
import type { SessionItem, Stance } from "./types";

export function useCoder() {
  const [coder, setCoderState] = useState(getCoder);

  useEffect(() => {
    persistCoder(coder);
  }, [coder]);

  return [coder, setCoderState] as const;
}

export function useStance() {
  const [stance, setStanceState] = useState<Stance>(getStance);

  useEffect(() => {
    persistStance(stance);
  }, [stance]);

  return [stance, setStanceState] as const;
}

/**
 * Session active. Quand une session est ouverte, c'est elle qui porte la
 * posture : l'outil ne doit pas pouvoir enregistrer un codage sous une posture
 * différente de celle que la session déclare.
 */
export function useActiveSession() {
  const [sessionId, setSessionIdState] = useState<string | null>(getSessionId);

  const sessionsQuery = useQuery({ queryKey: ["sessions"], queryFn: api.sessions.list });

  const session: SessionItem | null =
    sessionsQuery.data?.find((item) => item.id === sessionId && !item.endedAt) ?? null;

  // Une session close ou disparue ne doit pas rester épinglée localement.
  useEffect(() => {
    if (sessionId && sessionsQuery.data && !session) {
      persistSessionId(null);
      setSessionIdState(null);
    }
  }, [sessionId, sessionsQuery.data, session]);

  const setSession = (id: string | null) => {
    persistSessionId(id);
    setSessionIdState(id);
  };

  return { session, setSession, sessions: sessionsQuery.data ?? [] };
}
