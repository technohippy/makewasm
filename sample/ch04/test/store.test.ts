import { assertEquals } from "https://deno.land/std@0.93.0/testing/asserts.ts"
import { WasmModule, WasmBuffer } from "../src/wasm.ts"

async function loadModule(wasmPath:string): Promise<[WasmModule, WasmBuffer, Uint8Array]> {
  const code = await Deno.readFile(wasmPath);
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule();
  wasmModule.load(wasmBuffer);
  return [wasmModule, wasmBuffer, code];
}

Deno.test("store module.wasm", async () => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/module.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})

Deno.test("store const.wasm", async () => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/const.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})

Deno.test("store local.wasm", async() => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/local.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})

Deno.test("store add.wasm", async() => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/add.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})

Deno.test("store if.wasm", async() => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/if.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})

Deno.test("store loop.wasm", async() => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/loop.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})

Deno.test("store call.wasm", async() => {
  const [wasmModule, wasmBuffer, code] = await loadModule("data/call.wasm");
  const newCode = new Uint8Array(wasmBuffer.byteLength)
  const newBuffer = new WasmBuffer(newCode);
  wasmModule.store(newBuffer)
  assertEquals(code, newCode)
})
