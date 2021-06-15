import { Buffer } from "./buffer.ts"

export class ModuleNode {
  magic?: Uint8Array
  version?: Uint8Array
  sections: SectionNode[] = [] // const.wasm

  get typeSection():TypeSectionNode {
    return this.sections.find(sec => sec instanceof TypeSectionNode) as TypeSectionNode
  }

  get exportSection():ExportSectionNode {
    return this.sections.find(sec => sec instanceof ExportSectionNode) as ExportSectionNode
  }

  get functionSection():FunctionSectionNode {
    return this.sections.find(sec => sec instanceof FunctionSectionNode) as FunctionSectionNode
  }

  get codeSection():CodeSectionNode {
    return this.sections.find(sec => sec instanceof CodeSectionNode) as CodeSectionNode
  }

  load(buffer:Buffer) {
    this.magic = buffer.readBytes(4)
    this.version = buffer.readBytes(4)
    while (true) {
      if (buffer.eof) break

      const section = this.loadSection(buffer)
      this.sections.push(section)
    }
  }

  loadSection(buffer:Buffer): SectionNode {
    const sectionId = buffer.readByte()
    const sectionSize = buffer.readU32()
    const sectionsBuffer = buffer.readBuffer(sectionSize)

    const section = SectionNode.create(sectionId)
    section.load(sectionsBuffer)
    return section
  }

  store(buffer:Buffer) {
    if (this.magic) buffer.writeBytes(this.magic)
    if (this.version) buffer.writeBytes(this.version)
    for (const section of this.sections) { // 追加
      section.store(buffer)
    }
  }
}

abstract class SectionNode {
  static create(sectionId:number): SectionNode {
    switch (sectionId) {
      case 1:
        return new TypeSectionNode();
      case 3:
        return new FunctionSectionNode();
      case 7:
        return new ExportSectionNode(); // 追加
      case 10:
        return new CodeSectionNode();
      default:
        throw new Error(`invaild section id: ${sectionId}`);
    }
  }

  abstract load(buffer:Buffer): void
  abstract store(buffer:Buffer): void // 追加
}

export class TypeSectionNode extends SectionNode {
  funcTypes:FuncTypeNode[] = []

  load(buffer:Buffer) {
    this.funcTypes = buffer.readVec<FuncTypeNode>(():FuncTypeNode => {
      const functype = new FuncTypeNode()
      functype.load(buffer)
      return functype
    })
  }

  store(buffer:Buffer) {
    buffer.writeByte(1) // TODO: ID
    const sectionsBuffer = new Buffer({buffer:new ArrayBuffer(1024)}) // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.funcTypes, (funcType:FuncTypeNode) => {
      funcType.store(sectionsBuffer)
    })
    buffer.append(sectionsBuffer)
  }
}

export class FuncTypeNode {
  static get TAG() { return 0x60 }

  paramType = new ResultTypeNode()
  resultType = new ResultTypeNode()

  load(buffer:Buffer) {
    if (buffer.readByte() !== FuncTypeNode.TAG) {
      throw new Error("invalid functype")
    }
    this.paramType = new ResultTypeNode()
    this.paramType.load(buffer)
    this.resultType = new ResultTypeNode()
    this.resultType.load(buffer)
  }

  store(buffer:Buffer) {
    buffer.writeByte(FuncTypeNode.TAG)
    this.paramType.store(buffer)
    this.resultType.store(buffer)
  }
}

export class ResultTypeNode {
  valTypes: ValType[] = []

  load(buffer:Buffer) {
    this.valTypes = buffer.readVec<ValType>(():ValType => {
      return buffer.readByte() as ValType
    })
  }

  store(buffer:Buffer) {
    buffer.writeVec<ValType>(this.valTypes, (valType:ValType) => {
      buffer.writeByte(valType)
    })
  }
}

export class ExportSectionNode extends SectionNode {
  exports: ExportNode[] = []

  load(buffer:Buffer) {
    this.exports = buffer.readVec<ExportNode>(():ExportNode => {
      const ex = new ExportNode()
      ex.load(buffer)
      return ex
    })
  }

  store(buffer:Buffer) {
    buffer.writeByte(7) // TODO: ID
    const sectionsBuffer = new Buffer({buffer:new ArrayBuffer(1024)}) // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec<ExportNode>(this.exports, (ex:ExportNode) => {
      ex.store(sectionsBuffer)
    })
    buffer.append(sectionsBuffer)
  }
}

export class ExportNode {
  name!:string
  exportDesc!:ExportDescNode

  load(buffer:Buffer) {
    this.name = buffer.readName()
    this.exportDesc = new ExportDescNode()
    this.exportDesc.load(buffer)
  }

  store(buffer:Buffer) {
    buffer.writeName(this.name)
    this.exportDesc.store(buffer)
  }
}

export class ExportDescNode {
  tag!:number
  index!:number

  load(buffer:Buffer) {
    this.tag = buffer.readByte()
    this.index = buffer.readU32()
  }

  store(buffer:Buffer) {
    buffer.writeByte(this.tag)
    buffer.writeU32(this.index)
  }
}

export class FunctionSectionNode extends SectionNode {
  typeIdxs:TypeIdx[] = []

  load(buffer:Buffer) {
    this.typeIdxs = buffer.readVec<TypeIdx>(():TypeIdx => {
      return buffer.readU32() as TypeIdx
    })
  }

  store(buffer:Buffer) {
    buffer.writeByte(3) // TODO: ID
    const sectionsBuffer = new Buffer({buffer:new ArrayBuffer(1024)}) // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec<TypeIdx>(this.typeIdxs, (typeIdx:TypeIdx) => {
      sectionsBuffer.writeU32(typeIdx)
    })
    buffer.append(sectionsBuffer)
  }
}

export class CodeSectionNode extends SectionNode {
  codes: CodeNode[] = []

  load(buffer:Buffer) {
    this.codes = buffer.readVec<CodeNode>(():CodeNode => {
      const code = new CodeNode()
      code.load(buffer)
      return code
    })
  }

  store(buffer:Buffer) {
    buffer.writeByte(10) // TODO: ID
    const sectionsBuffer = new Buffer({buffer:new ArrayBuffer(1024)}) // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.codes, (code:CodeNode) => {
      code.store(sectionsBuffer)
    })
    buffer.append(sectionsBuffer)
  }
}

export class CodeNode {
  size?: number
  func?: FuncNode

  load(buffer:Buffer) {
    this.size = buffer.readU32()
    const funcBuffer = buffer.readBuffer(this.size)
    this.func = new FuncNode()
    this.func.load(funcBuffer)
  }

  store(buffer:Buffer) {
    const funcBuffer = new Buffer({buffer:new ArrayBuffer(1024)}) // TODO
    this.func?.store(funcBuffer)
    buffer.append(funcBuffer)
  }
}

export class FuncNode {
  localses: LocalsNode[] = []
  expr?: ExprNode

  load(buffer:Buffer) {
    this.localses = buffer.readVec<LocalsNode>(():LocalsNode => {
      const locals = new LocalsNode()
      locals.load(buffer)
      return locals
    })
    this.expr = new ExprNode()
    this.expr.load(buffer)
  }

  store(buffer:Buffer) {
    buffer.writeVec<LocalsNode>(this.localses, (locals:LocalsNode) => {
      locals.store(buffer)
    })
    this.expr?.store(buffer)
  }
}

export class LocalsNode {
  num!: number
  valType!: ValType

  load(buffer:Buffer) {
    this.num = buffer.readU32()
    this.valType = buffer.readByte() as ValType
  }

  store(buffer:Buffer) {
    buffer.writeU32(this.num)
    buffer.writeByte(this.valType)
  }
}

export class ExprNode {
  instrs: InstrNode[] = []
  endOp!: Op

  load(buffer:Buffer) {
    while (true) {
      const opcode = buffer.readByte() as Op
      if (opcode === Op.End || opcode === Op.Else) {
        this.endOp = opcode
        break
      }

      const instr = InstrNode.create(opcode)
      if (!instr) {
        throw new Error(`invalid opcode: 0x${opcode.toString(16)}`)
      }

      instr.load(buffer)
      this.instrs.push(instr)

      if (buffer.eof) break
    }
  }

  store(buffer:Buffer) {
    for (const instr of this.instrs) {
      instr.store(buffer)
    }
    buffer.writeByte(this.endOp)
  }
}

export class InstrNode {
  opcode: Op

  static create(opcode:Op): InstrNode | null {
    switch (opcode) {
      case Op.If:
        return new IfInstrNode(opcode) // 追加
      case Op.Block:
        return new BlockInstrNode(opcode)
      case Op.Loop:
        return new LoopInstrNode(opcode)
      case Op.Br:
        return new BrInstrNode(opcode)
      case Op.BrIf:
        return new BrIfInstrNode(opcode)
      case Op.Call:
        return new CallInstrNode(opcode)
      case Op.I32Const:
        return new I32ConstInstrNode(opcode)
      case Op.I32Eqz:
        return new I32EqzInstrNode(opcode)
      case Op.I32Add:
        return new I32AddInstrNode(opcode)
      case Op.I32LtS:
        return new I32LtSInstrNode(opcode)
      case Op.I32GeS:
        return new I32GeSInstrNode(opcode)
      case Op.I32RemS:
        return new I32RemSInstrNode(opcode)
      case Op.LocalGet:
        return new LocalGetInstrNode(opcode) // 追加
      case Op.LocalSet:
        return new LocalSetInstrNode(opcode) // 追加
      default:
        return null
    }
  }

  constructor(opcode:Op) {
    this.opcode = opcode
  }

  load(buffer:Buffer) {
    // nop
  }

  store(buffer:Buffer) {
    buffer.writeByte(this.opcode)
  }
}

export class I32ConstInstrNode extends InstrNode {
  num!: number

  load(buffer:Buffer) {
    this.num = buffer.readI32()
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeI32(this.num)
  }
}

export class I32AddInstrNode extends InstrNode {
}

export class I32EqzInstrNode extends InstrNode {
}

export class I32LtSInstrNode extends InstrNode {
}

export class I32GeSInstrNode extends InstrNode {
}

export class I32RemSInstrNode extends InstrNode {
}

export class LocalGetInstrNode extends InstrNode {
  localIdx!: number

  load(buffer:Buffer) {
    this.localIdx = buffer.readU32()
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeU32(this.localIdx)
  }
}

export class LocalSetInstrNode extends InstrNode {
  localIdx!: number

  load(buffer:Buffer) {
    this.localIdx = buffer.readU32()
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeU32(this.localIdx)
  }
}

export class IfInstrNode extends InstrNode {
  blockType!: BlockType
  thenInstrs!: ExprNode
  elseInstrs?: ExprNode

  load(buffer:Buffer) {
    this.blockType = buffer.readByte()
    this.thenInstrs = new ExprNode()
    this.thenInstrs.load(buffer)
    if (this.thenInstrs.endOp === Op.Else) {
      this.elseInstrs = new ExprNode()
      this.elseInstrs.load(buffer)
    }
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeByte(this.blockType)
    this.thenInstrs.endOp = this.elseInstrs ? Op.Else : Op.End
    this.thenInstrs.store(buffer)
    this.elseInstrs?.store(buffer)
  }
}

export class BlockInstrNode extends InstrNode {
  blockType!: BlockType
  instrs!: ExprNode

  load(buffer:Buffer) {
    this.blockType = buffer.readByte()
    this.instrs = new ExprNode()
    this.instrs.load(buffer)
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeByte(this.blockType)
    this.instrs.store(buffer)
  }
}

export class LoopInstrNode extends InstrNode {
  blockType!: BlockType
  instrs!: ExprNode

  load(buffer:Buffer) {
    this.blockType = buffer.readByte()
    this.instrs = new ExprNode()
    this.instrs.load(buffer)
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeByte(this.blockType)
    this.instrs.store(buffer)
  }
}

export class BrInstrNode extends InstrNode {
  labelIdx!: LabelIdx

  load(buffer:Buffer) {
    this.labelIdx = buffer.readU32()
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeU32(this.labelIdx)
  }
}

export class BrIfInstrNode extends InstrNode {
  labelIdx!: LabelIdx

  load(buffer:Buffer) {
    this.labelIdx = buffer.readU32()
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeU32(this.labelIdx)
  }
}

export class CallInstrNode extends InstrNode {
  funcIdx!: FuncIdx

  load(buffer:Buffer) {
    this.funcIdx = buffer.readU32()
  }

  store(buffer:Buffer) {
    super.store(buffer)
    buffer.writeU32(this.funcIdx)
  }
}

type I32 = 0x7f
type I64 = 0x7e
type F32 = 0x7d
type F64 = 0x7c
type S33 = number
type NumType = I32 | I64 | F32 | F64
type FuncRef = 0x70
type ExternRef = 0x6f
type RefType = FuncRef | ExternRef
type ValType = NumType | RefType
type BlockType = 0x40 | ValType | S33
type LabelIdx = number 
type FuncIdx = number 
type TypeIdx = number

const Op = {
  If: 0x04,
  Block: 0x02,
  Loop: 0x03,
  Br: 0x0c,
  BrIf: 0x0d,
  Call: 0x10,
  LocalGet: 0x20,
  LocalSet: 0x21,
  I32Const: 0x41,
  I32Eqz: 0x45,
  I32LtS: 0x48,
  I32GeS: 0x4e,
  I32Add: 0x6a,
  I32RemS: 0x6f,
  Else: 0x05, // 追加
  End: 0x0b,
} as const
type Op = typeof Op[keyof typeof Op]; 