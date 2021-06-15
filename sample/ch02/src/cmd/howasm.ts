import { WasmModule, WasmBuffer } from "../wasm.ts"

const {args: [filename]} = Deno;

if (!filename) {
  console.error("no filename");
  Deno.exit(1);
}

const code = await Deno.readFile(filename);
const wasmBuffer = new WasmBuffer(code);
const wasmModule = new WasmModule();
wasmModule.load(wasmBuffer);
console.log(JSON.stringify(wasmModule, null, "  "));