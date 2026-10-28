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
const tsType = (f) =>
  (f.enum ? title(f.enum) : (scalars[f.type]?.[0] ?? f.type)) + (f.array ? "[]" : "");
const goType = (f) =>
  (f.array ? (f.fixed ? `[${f.array}]` : "[]") : "") +
  (f.enum ? title(f.enum) : (scalars[f.type]?.[1] ?? f.type));
const domains = Object.entries(schema.enums);
for (const [name, values] of domains) {
  const assignments = Object.values(values).sort((a, b) => a - b);
  if (!assignments.length || assignments.some((value, index) => value !== index))
    throw new Error(`${name}: expected unique contiguous numeric assignments from zero`);
}
for (const [name, flags] of Object.entries(schema.flags)) {
  const bits = Object.values(flags.bits);
  if (
    !Number.isInteger(flags.masks.all) ||
    flags.masks.all < 0 ||
    flags.masks.all > 255 ||
    bits.some((bit) => !Number.isInteger(bit) || bit === 0 || (bit & (bit - 1)) !== 0) ||
    new Set(bits).size !== bits.length ||
    Object.values(flags.masks).some(
      (mask) => !Number.isInteger(mask) || (mask & ~flags.masks.all) !== 0,
    ) ||
    bits.some((bit) => (bit & ~flags.masks.all) !== 0)
  )
    throw new Error(`${name}: invalid bit or mask assignment`);
}
const wireTypes = Object.fromEntries(
  Object.entries(schema.types).map(([name, fields]) => [
    name,
    fields.map((f) => {
      if (f.flags) {
        const flags = schema.flags[f.flags];
        if (!flags || f.type !== "u8") throw new Error(`${name}.${f.name}: invalid flags domain`);
        for (const part of Object.values(f.subfields ?? {})) {
          const mask = flags.masks[part.mask];
          const domain = schema.enums[part.enum];
          if (!Number.isInteger(mask) || !domain || Math.max(...Object.values(domain)) !== mask)
            throw new Error(`${name}.${f.name}: invalid packed enum association`);
        }
        const wire = { ...f, mask: flags.masks.all };
        delete wire.flags;
        delete wire.subfields;
        return wire;
      }
      if (!f.enum) return f;
      const domain = schema.enums[f.enum];
      if (!domain || Array.isArray(domain) || f.type !== "u8" || Object.keys(domain).length > 256)
        throw new Error(`${name}.${f.name}: invalid enum domain`);
      const wire = { ...f, max: Math.max(...Object.values(domain)) };
      delete wire.enum;
      return wire;
    }),
  ]),
);
let ts = "// Generated from protocol/schema.json. Run pnpm generate; do not edit.\n";
ts +=
  "import { encodeRecord, decodeRecord, encodeFrame, decodeFrame, projectRecord } from '../protocol/runtime';\n";
ts += `export const protocolVersion = ${schema.version};\n`;
let constantsTS = "// Generated from protocol/schema.json. Run pnpm generate; do not edit.\n";
for (const [name, value] of Object.entries(schema.constants))
  constantsTS += `export const ${title(name)} = ${value};\n`;
ts +=
  "import { DefaultFrameBytes, RecordLimitBytes } from './constants';\nexport * from './constants';\n";
for (const [name, values] of Object.entries(schema.flags))
  for (const [member, value] of Object.entries({ ...values.bits, ...values.masks }))
    ts += `export const ${title(name)}${title(member)} = ${value};\n`;
for (const [name, values] of domains) {
  const domain = title(name);
  for (const [member, value] of Object.entries(values))
    ts += `export const ${domain}${title(member)} = ${value};\n`;
  ts += `export type ${domain} = ${Object.keys(values)
    .map((member) => `typeof ${domain}${title(member)}`)
    .join(" | ")};\n`;
}
ts += `export const layouts = ${JSON.stringify(wireTypes, null, 2)} as const;\n`;
for (const [name, fields] of Object.entries(schema.types)) {
  ts += `export interface ${name} {\n${fields.map((f) => `  ${f.name}: ${tsType(f)};`).join("\n")}\n}\n`;
  ts += `export function encode${name}(value: ${name}, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, '${name}', value, limit); }\n`;
  ts += `export function decode${name}(bytes: Uint8Array, limit = RecordLimitBytes): ${name} { return decodeRecord(layouts, '${name}', bytes, limit) as ${name}; }\n`;
}
ts += `export const messageTypes = ${JSON.stringify(schema.messages, null, 2)} as const;\n`;
ts += `export interface Messages {\n${Object.keys(schema.messages)
  .map((n) => `  ${n}: ${n};`)
  .join("\n")}\n}\n`;
ts += `export function encodeMessage<K extends keyof Messages>(type: K, value: Messages[K], limit = DefaultFrameBytes): Uint8Array { return encodeFrame(layouts, type, messageTypes[type].id, value, limit); }\n`;
ts += `export function decodeMessage(bytes: Uint8Array, limit = DefaultFrameBytes): { [K in keyof Messages]: { type: K; value: Messages[K] } }[keyof Messages] { return decodeFrame(layouts, messageTypes, bytes, limit) as ReturnType<typeof decodeMessage>; }\n`;
ts += `export function projectBaseline(value: Baseline): Uint8Array { return projectRecord(layouts, 'Projection', { round: value.round, configurationId: value.context.configurationId, generationVersion: value.context.generationVersion, seed: value.context.seed, tick: value.tick, timeUs: value.timeUs, progress: value.progress, cars: value.cars, contact: value.contact, generator: value.generator, windows: value.windows }); }\n`;
let go = "// Code generated from protocol/schema.json; DO NOT EDIT.\npackage protocol\n\n";
go += `const DefaultConfigurationJSON = ${JSON.stringify(readFileSync(new URL("../configuration/defaults.json", import.meta.url), "utf8"))}\n`;
go += `const ProtocolVersion uint16 = ${schema.version}\n`;
for (const [name, value] of Object.entries(schema.constants))
  go += `const ${title(name)} = ${value}\n`;
for (const [name, values] of Object.entries(schema.flags))
  for (const [member, value] of Object.entries({ ...values.bits, ...values.masks }))
    go += `const ${title(name)}${title(member)} = ${value}\n`;
for (const [name, values] of domains) {
  const domain = title(name);
  go += `type ${domain} uint8\nconst (\n`;
  for (const [member, value] of Object.entries(values))
    go += `${domain}${title(member)} ${domain} = ${value}\n`;
  go += ")\n";
}
go += "var layouts = map[string][]field{\n";
for (const [name, fields] of Object.entries(wireTypes))
  go += `"${name}": {${fields.map((f) => `{Name: "${title(f.name)}", Type: "${f.type}", Array: ${f.array ?? 0}, Fixed: ${f.fixed ?? false}, Max: ${f.max ?? 0}, Mask: ${f.mask ?? 0}, Projection: ${f.projection ?? false}, Bits: ${f.bits ?? 0}}`).join(",")}},\n`;
go += "}\n";
for (const [name, fields] of Object.entries(schema.types)) {
  go += `type ${name} struct {\n${fields.map((f) => `${title(f.name)} ${goType(f)} \`json:"${f.name}"\``).join("\n")}\n}\n`;
  go += `func Encode${name}(value ${name}, limit int) ([]byte,error) { return encodeRecord("${name}", value, limit, false) }\n`;
  go += `func Decode${name}(bytes []byte, limit int) (${name},error) { var value ${name}; err := decodeRecord("${name}", bytes, &value, limit); return value,err }\n`;
}
go +=
  'func ProjectBaseline(value Baseline) ([]byte,error) { return encodeRecord("Projection", Projection{Round:value.Round, ConfigurationId:value.Context.ConfigurationId, GenerationVersion:value.Context.GenerationVersion, Seed:value.Context.Seed, Tick:value.Tick, TimeUs:value.TimeUs, Progress:value.Progress, Cars:value.Cars, Contact:value.Contact, Generator:value.Generator, Windows:value.Windows}, RecordLimitBytes, true) }\n';
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
  ["packages/contracts/generated/constants.ts", constantsTS],
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
