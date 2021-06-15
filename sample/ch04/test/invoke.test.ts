import { assertEquals } from "https://deno.land/std@0.93.0/testing/asserts.ts"
import { WasmModule, WasmBuffer } from "../src/wasm.ts"

Deno.test("invoke add.wasm", async () => {
  const code = await Deno.readFile("data/add.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule();
  wasmModule.load(wasmBuffer);
  const instance = wasmModule.instantiate()
  assertEquals(3, instance.exports.add(1, 2))
  assertEquals(300, instance.exports.add(100, 200))
  assertEquals(1, instance.exports.add(2, -1))
  assertEquals(100, instance.exports.add(200, -100))
})

Deno.test("invoke if.wasm", async () => {
  const code = await Deno.readFile("data/if.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule();
  wasmModule.load(wasmBuffer);
  const instance = wasmModule.instantiate()
  assertEquals(0, instance.exports.ge10(1))
  assertEquals(1, instance.exports.ge10(100))
})

Deno.test("invoke loop.wasm", async () => {
  const code = await Deno.readFile("data/loop.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule();
  wasmModule.load(wasmBuffer);
  const instance = wasmModule.instantiate()
  assertEquals(42, instance.exports.loop())
})

Deno.test("invoke call.wasm", async () => {
  const code = await Deno.readFile("data/call.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule();
  wasmModule.load(wasmBuffer);
  const instance = wasmModule.instantiate()
  assertEquals(52, instance.exports.add42(10))
  assertEquals(32, instance.exports.add42(-10))
})

Deno.test("invoke gcd.wasm", async () => {
  const code = await Deno.readFile("data/gcd.wasm");
  const wasmBuffer = new WasmBuffer(code);
  const wasmModule = new WasmModule();
  wasmModule.load(wasmBuffer);
  const instance = wasmModule.instantiate()
  assertEquals(6, instance.exports.gcd(42, 12))
  assertEquals(6, instance.exports.gcd(42, 24))
  assertEquals(14, instance.exports.gcd(42, 28))
})