import { useEffect, useRef, useState } from "react";
import {
  PairedConnection,
  type ConnectionOptions,
  type PairedState,
} from "@/transport/PairedConnection";
import { MultiplayerView } from "./MultiplayerView";
import { RaceView } from "@/components/RaceView";
import { localName } from "@/transport/localName";

export function MultiplayerScreen({ mode, onBack }: { mode: 1 | 2; onBack: () => void }) {
  const connection = useRef<PairedConnection | undefined>(undefined);
  const [client, setClient] = useState<PairedConnection>();
  const [state, setState] = useState<PairedState>();
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  useEffect(() => {
    let disposed = false;
    const focus = () => connection.current?.focus(document.hasFocus(), document.hidden);
    const load = async () => {
      try {
        const options: ConnectionOptions = import.meta.env.DEV
          ? await fetch("/__transport-config").then((response) => {
              if (!response.ok) throw new Error("Start pnpm dev:transport for secure multiplayer");
              return response.json() as Promise<ConnectionOptions>;
            })
          : { server: location.origin };
        if (disposed) return;
        const client = new PairedConnection(options, (next) => {
          setState(next);
        });
        connection.current = client;
        setClient(client);
        setState({ ...client.state });
        focus();
        if (client.hasCredential) await client.connect(2);
      } catch (failure) {
        if (!disposed) setError(String(failure instanceof Error ? failure.message : failure));
      }
    };
    void load();
    window.addEventListener("focus", focus);
    window.addEventListener("blur", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = setInterval(() => setClock(performance.now() * 1000), 50);
    return () => {
      disposed = true;
      clearInterval(timer);
      connection.current?.dispose();
      connection.current = undefined;
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);

  return (
    <MultiplayerView
      mode={mode}
      onBack={onBack}
      playerName={localName()}
      state={state}
      error={error}
      clock={clock}
      actions={client}
      focused={!document.hidden && document.hasFocus()}
      renderRace={
        client && state?.context
          ? (props) => <RaceView connection={client} state={state} {...props} />
          : undefined
      }
    />
  );
}
