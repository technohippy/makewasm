import { assertEquals } from "https://deno.land/std@0.93.0/testing/asserts.ts"
import { WasmModule } from "../src/wasm.ts"

Deno.test("load add.wat", async () => {
  const code = await Deno.readFile("data/add.wat");
  const wasmModule = new WasmModule(code);
  assertEquals(`(module
  (func (export "add") (param $p1 i32) (param $p2 i32) (result i32)
    (i32.add (local.get $p1) (local.get $p2))
  )
)`, wasmModule.code)
})