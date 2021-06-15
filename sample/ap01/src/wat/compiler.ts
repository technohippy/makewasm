import { Peg } from "./parser.js"
import { ModuleNode, ExportSectionNode, ExportNode, ExportDescNode } from "../core/node.ts"
import { Buffer } from "../core/buffer.ts"

const wat:any = Peg.parse(`(module
  (func (export "add") (param $p1 i32) (param $p2 i32) (result i32)
    (i32.add (local.get $p1) (local.get $p2))
  )
)`)

//console.log(JSON.stringify(wat, null, "  "))

if (wat.node !== "module") {
  throw new Error(`invalid wat: ${wat.node}`)
}

const mod = new ModuleNode()
mod.magic = new Uint8Array([0x00, 0x61, 0x73, 0x6d]).buffer
mod.version = new Uint8Array([0x01, 0x00, 0x00, 0x00]).buffer

let funcidx = 0
for (const sec of wat.fields) {
  if (sec.node === "funcsec") {
    if (sec.export) {
      const exportNode = new ExportNode()
      exportNode.name = sec.export
      exportNode.exportDesc = new ExportDescNode()
      exportNode.exportDesc.tag = 0x00 // func
      exportNode.exportDesc.index = funcidx
      const exportSecNode = new ExportSectionNode()
      exportSecNode.exports.push(exportNode)
      mod.sections.push(exportSecNode)
    }
    funcidx++
  }
}

const buf = new Buffer(new Uint8Array(17))
mod.store(buf)
Deno.writeFile("add.wasm", new Uint8Array(buf.buffer))