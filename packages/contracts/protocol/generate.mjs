import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const schema = JSON.parse(readFileSync(new URL("schema.json", import.meta.url), "utf8"));
const check = process.argv.includes("--check");
const scalars = {
  u8: ["number", "uint8"],
  u16: ["number", "uint16"],
  u32: ["number", "uint32"],
  us: ["number", "uint64"],
  f64: ["number", "float64"],
  string: ["string", "string"],
  bytes: ["Uint8Array", "[]byte"],
};
const title = (s) => s[0].toUpperCase() + s.slice(1);
const tsType = (f) => (scalars[f.type]?.[0] ?? f.type) + (f.array ? "[]" : "");
const goType = (f) =>
  (f.array ? (f.fixed ? `[${f.array}]` : "[]") : "") + (scalars[f.type]?.[1] ?? f.type);
let ts = "// Generated from protocol/schema.json. Run pnpm generate; do not edit.\n";
ts +=
  "import { encodeRecord, decodeRecord, encodeFrame, decodeFrame, projectRecord } from '../protocol/runtime';\n";
ts += `export const protocolVersion = ${schema.version};\n`;
ts += `export const layouts = ${JSON.stringify(schema.types, null, 2)} as const;\n`;
for (const [name, fields] of Object.entries(schema.types)) {
  ts += `export interface ${name} {\n${fields.map((f) => `  ${f.name}: ${tsType(f)};`).join("\n")}\n}\n`;
  ts += `export function encode${name}(value: ${name}, limit = 1048576): Uint8Array { return encodeRecord(layouts, '${name}', value, limit); }\n`;
  ts += `export function decode${name}(bytes: Uint8Array, limit = 1048576): ${name} { return decodeRecord(layouts, '${name}', bytes, limit) as ${name}; }\n`;
}
ts += `export const messageTypes = ${JSON.stringify(schema.messages, null, 2)} as const;\n`;
ts += `export interface Messages {\n${Object.keys(schema.messages)
  .map((n) => `  ${n}: ${n};`)
  .join("\n")}\n}\n`;
ts += `export function encodeMessage<K extends keyof Messages>(type: K, value: Messages[K], limit = 65536): Uint8Array { return encodeFrame(layouts, type, messageTypes[type].id, value, limit); }\n`;
ts += `export function decodeMessage(bytes: Uint8Array, limit = 65536): { [K in keyof Messages]: { type: K; value: Messages[K] } }[keyof Messages] { return decodeFrame(layouts, messageTypes, bytes, limit) as ReturnType<typeof decodeMessage>; }\n`;
ts += `export function projectBaseline(value: Baseline): Uint8Array { return projectRecord(layouts, 'Projection', { round: value.round, configurationId: value.context.configurationId, generationVersion: value.context.generationVersion, seed: value.context.seed, tick: value.tick, timeUs: value.timeUs, progress: value.progress, cars: value.cars, contact: value.contact, generator: value.generator, windows: value.windows }); }\n`;
let go = "// Code generated from protocol/schema.json; DO NOT EDIT.\npackage protocol\n\n";
go += `const DefaultConfigurationJSON = ${JSON.stringify(readFileSync(new URL("../configuration/defaults.json", import.meta.url), "utf8"))}\n`;
go += `const ProtocolVersion uint16 = ${schema.version}\n`;
go += "var layouts = map[string][]field{\n";
for (const [name, fields] of Object.entries(schema.types))
  go += `"${name}": {${fields.map((f) => `{Name: "${title(f.name)}", Type: "${f.type}", Array: ${f.array ?? 0}, Fixed: ${f.fixed ?? false}, Max: ${f.max ?? 0}, Mask: ${f.mask ?? 0}, Projection: ${f.projection ?? false}, Bits: ${f.bits ?? 0}}`).join(",")}},\n`;
go += "}\n";
for (const [name, fields] of Object.entries(schema.types)) {
  go += `type ${name} struct {\n${fields.map((f) => `${title(f.name)} ${goType(f)} \`json:"${f.name}"\``).join("\n")}\n}\n`;
  go += `func Encode${name}(value ${name}, limit int) ([]byte,error) { return encodeRecord("${name}", value, limit, false) }\n`;
  go += `func Decode${name}(bytes []byte, limit int) (${name},error) { var value ${name}; err := decodeRecord("${name}", bytes, &value, limit); return value,err }\n`;
}
go +=
  'func ProjectBaseline(value Baseline) ([]byte,error) { return encodeRecord("Projection", Projection{Round:value.Round, ConfigurationId:value.Context.ConfigurationId, GenerationVersion:value.Context.GenerationVersion, Seed:value.Context.Seed, Tick:value.Tick, TimeUs:value.TimeUs, Progress:value.Progress, Cars:value.Cars, Contact:value.Contact, Generator:value.Generator, Windows:value.Windows}, 1048576, true) }\n';
go += "func EncodeMessage(value any, limit int) ([]byte,error) { switch v := value.(type) {\n";
for (const [name, m] of Object.entries(schema.messages))
  go += `case ${name}: return encodeFrame("${name}", ${m.id}, v, limit)\n`;
go += 'default: return nil, invalid("unknown message type") } }\n';
go +=
  "func DecodeMessage(bytes []byte, limit int) (any,error) { body, err := frameBody(bytes,limit); if err != nil {return nil,err}; switch body[0] {\n";
for (const [name, m] of Object.entries(schema.messages))
  go += `case ${m.id}: return Decode${name}(body[1:], limit)\n`;
go += 'default: return nil, invalid("unknown message type") } }\n';
// gofmt also runs in check mode, entirely through stdin, so verification never rewrites output.
const formatted = spawnSync("gofmt", [], { input: go, encoding: "utf8" });
if (formatted.status !== 0) throw new Error(formatted.stderr);
const outputs = new Map([
  ["packages/contracts/generated/protocol.ts", ts],
  ["apps/server/protocol/generated.go", formatted.stdout],
]);
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1];
for (const [path, content] of outputs) {
  if (target === "ts" && path.endsWith(".go")) continue;
  if (target === "go" && path.endsWith(".ts")) continue;
  if (check) {
    let existing;
    try {
      existing = readFileSync(root + path, "utf8");
    } catch {
      /* Missing output is stale. */
    }
    if (existing !== content)
      throw new Error(`Stale generated output: ${path}. Run pnpm generate.`);
  } else {
    mkdirSync(root + path.substring(0, path.lastIndexOf("/")), { recursive: true });
    writeFileSync(root + path, content);
  }
}
