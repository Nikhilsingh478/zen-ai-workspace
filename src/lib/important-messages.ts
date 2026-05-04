import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type ImportantMessage = {
  id: string;
  motive: string;
  time: string;
  message: string;
  createdAt: string;
};

export type ImportantMessageInput = {
  motive: string;
  time: string;
  message: string;
};

type Row = {
  id: string;
  motive: string;
  time: string;
  message: string;
  created_at: string;
};

type State = {
  messages: ImportantMessage[];
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { messages: [], loaded: false };
let booted = false;

function emit() {
  listeners.forEach((fn) => fn());
}
function setState(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): State {
  return state;
}

function rowToMessage(row: Row): ImportantMessage {
  return {
    id: row.id,
    motive: row.motive,
    time: row.time,
    message: row.message,
    createdAt: row.created_at,
  };
}

async function refetch() {
  const { data, error } = await supabase
    .from("important_messages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  setState({ messages: (data as Row[]).map(rowToMessage), loaded: true });
}

async function ensureBooted() {
  if (booted) return;
  booted = true;
  try {
    await refetch();
  } catch (err) {
    console.error("[important-messages] load error", err);
    toast.error("Failed to load messages");
    setState({ loaded: true });
  }
}

export function useImportantMessages() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    ensureBooted();
  }, []);

  const add = async (input: ImportantMessageInput) => {
    try {
      const { data, error } = await supabase
        .from("important_messages")
        .insert({
          motive: input.motive.trim(),
          time: input.time.trim(),
          message: input.message.trim(),
        })
        .select("*")
        .single();
      if (error) throw error;
      setState({ messages: [rowToMessage(data as Row), ...state.messages] });
      toast.success("Message saved", { duration: 1500 });
    } catch (err) {
      console.error("[important-messages] add error", err);
      toast.error("Failed to save message");
    }
  };

  const update = async (id: string, input: ImportantMessageInput) => {
    try {
      const { data, error } = await supabase
        .from("important_messages")
        .update({
          motive: input.motive.trim(),
          time: input.time.trim(),
          message: input.message.trim(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = rowToMessage(data as Row);
      setState({
        messages: state.messages.map((m) => (m.id === id ? updated : m)),
      });
      toast.success("Message updated", { duration: 1500 });
    } catch (err) {
      console.error("[important-messages] update error", err);
      toast.error("Failed to update message");
    }
  };

  const remove = async (id: string) => {
    const prev = state.messages;
    setState({ messages: state.messages.filter((m) => m.id !== id) });
    try {
      const { error } = await supabase
        .from("important_messages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("[important-messages] delete error", err);
      toast.error("Failed to delete message");
      setState({ messages: prev });
    }
  };

  return {
    messages: snap.messages,
    loaded: snap.loaded,
    add,
    update,
    remove,
  };
}