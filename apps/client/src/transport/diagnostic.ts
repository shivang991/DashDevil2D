import {
  AdmissionOperationCreate,
  AdmissionOperationJoin,
  AdmissionOperationResume,
} from "@dashdevil/contracts/protocol";
import { PairedConnection, type ConnectionOptions } from "./PairedConnection";
import "./diagnostic.css";

const config: ConnectionOptions = import.meta.env.DEV
  ? await fetch("/__transport-config").then((response) => {
      if (!response.ok) throw new Error("Start the HTTPS transport development command first");
      return response.json() as Promise<ConnectionOptions>;
    })
  : { server: location.origin };
const connection = new PairedConnection({ ...config, diagnostic: true }, (state) => {
  const fields: Record<string, string | number> = {
    status: state.status,
    "room-code": state.code || "—",
    "seat-session": state.identity?.seatSession ?? "—",
    "pair-generation": state.identity?.pairGeneration ?? "—",
    "connected-seats": state.connectedSeats,
    verified: state.verified,
    barriers: state.barriers,
    "clock-samples": state.clockSamples,
    positions: state.positions || "—",
  };
  for (const [field, value] of Object.entries(fields))
    document.querySelector(`[data-testid="${field}"]`)!.textContent = String(value);
  document.querySelector("#evidence")!.textContent = JSON.stringify(
    { ...state, browser: navigator.userAgent },
    null,
    2,
  );
});
const code = document.querySelector<HTMLInputElement>("#code")!;
document
  .querySelector("#create")!
  .addEventListener("click", () => void connection.connect(AdmissionOperationCreate));
document
  .querySelector("#join")!
  .addEventListener("click", () => void connection.connect(AdmissionOperationJoin, code.value));
for (const id of ["recover", "replace"])
  document
    .querySelector(`#${id}`)!
    .addEventListener("click", () => void connection.connect(AdmissionOperationResume));
document.querySelector("#leave")!.addEventListener("click", () => connection.leave());
document.querySelector("#drop-room")!.addEventListener("click", () => connection.drop("room"));
document
  .querySelector("#drop-gameplay")!
  .addEventListener("click", () => connection.drop("gameplay"));

document.querySelector("#baseline")!.addEventListener("click", () => connection.requestBaseline());
