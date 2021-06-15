import { WasmModule } from "../wasm.ts"

const {args: [filename]} = Deno;

if (!filename) {
  console.error("no filename");
  Deno.exit(1);
}

const code = await Deno.readFile(filename);
const wasmModule = new WasmModule(code);
console.log(JSON.stringify(wasmModule, null, "  "));