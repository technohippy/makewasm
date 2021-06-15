class Buffer {
    #cursor=0;
    #buffer;
    #view;
    get cursor() {
        return this.#cursor;
    }
    setCursor(c) {
        this.#cursor = c;
    }
    constructor({ buffer: buffer1  }){
        this.#buffer = buffer1;
        this.#view = new DataView(buffer1);
    }
    readBytes(size) {
        if (this.#buffer.byteLength < this.#cursor + size) {
            return new Uint8Array(0);
        }
        const slice = this.#buffer.slice(this.#cursor, this.#cursor + size);
        this.#cursor += size;
        return new Uint8Array(slice);
    }
    get byteLength() {
        return this.#buffer.byteLength;
    }
    get eof() {
        return this.byteLength <= this.#cursor;
    }
    get buffer() {
        return this.#buffer;
    }
    readByte() {
        const bytes = this.readBytes(1);
        if (bytes.length <= 0) {
            return -1;
        }
        return bytes[0];
    }
    readBuffer(size = this.#buffer.byteLength - this.#cursor) {
        return new Buffer(this.readBytes(size));
    }
    readU32() {
        let result = 0;
        let shift = 0;
        while(true){
            const __byte = this.readByte();
            result |= (__byte & 127) << shift;
            shift += 7;
            if ((128 & __byte) === 0) {
                return result;
            }
        }
    }
    readS32() {
        let result = 0;
        let shift = 0;
        while(true){
            const __byte = this.readByte();
            result |= (__byte & 127) << shift;
            shift += 7;
            if ((128 & __byte) === 0) {
                if (shift < 32 && (__byte & 64) !== 0) {
                    return result | ~0 << shift;
                }
                return result;
            }
        }
    }
    readI32() {
        return this.readS32();
    }
    readVec(readT) {
        const vec = [];
        const size = this.readU32();
        for(let i = 0; i < size; i++){
            vec.push(readT());
        }
        return vec;
    }
    readName() {
        const size = this.readU32();
        const bytes = this.readBytes(size);
        return new TextDecoder("utf-8").decode(bytes.buffer);
    }
    writeBytes(bytes) {
        const u8s = new Uint8Array(bytes);
        for (let __byte of u8s){
            this.writeByte(__byte);
        }
    }
    writeByte(__byte) {
        this.#view.setUint8(this.#cursor++, __byte);
    }
    writeU32(value) {
        value |= 0;
        const result = [];
        while(true){
            const __byte = value & 127;
            value >>= 7;
            if (value === 0 && (__byte & 64) === 0) {
                result.push(__byte);
                break;
            }
            result.push(__byte | 128);
        }
        const u8a = new Uint8Array(result);
        this.writeBytes(u8a.buffer);
    }
    writeS32(value) {
        value |= 0;
        const result = [];
        while(true){
            const __byte = value & 127;
            value >>= 7;
            if (value === 0 && (__byte & 64) === 0 || value === -1 && (__byte & 64) !== 0) {
                result.push(__byte);
                break;
            }
            result.push(__byte | 128);
        }
        const u8a = new Uint8Array(result);
        this.writeBytes(u8a.buffer);
    }
    writeI32(num) {
        this.writeS32(num);
    }
    writeName(name) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(name);
        this.writeU32(bytes.length);
        this.writeBytes(bytes);
    }
    writeVec(ts, writeT) {
        this.writeU32(ts.length);
        for (const t of ts){
            writeT(t);
        }
    }
    append(buffer) {
        this.writeU32(buffer.#cursor);
        for(let i = 0; i < buffer.#cursor; i++){
            this.writeByte(buffer.peek(i));
        }
    }
    peek(pos = 0) {
        return this.#view.getUint8(pos);
    }
}
class StackBuffer extends Buffer {
    readBytes(size) {
        if (this.cursor - size < 0) {
            return new Uint8Array(0);
        }
        const slice = this.buffer.slice(this.cursor - size, this.cursor);
        this.setCursor(this.cursor - size);
        return new Uint8Array(slice).reverse();
    }
    writeBytes(bytes) {
        const u8s = new Uint8Array(bytes).reverse();
        for (let __byte of u8s){
            this.writeByte(__byte);
        }
    }
}
class Instance {
    #module;
    #exports;
    #context;
    get exports() {
        return this.#exports;
    }
    constructor(module){
        this.#module = module;
        this.#exports = {
        };
        this.#context = new Context();
    }
    compile() {
        const typeSection = this.#module.typeSection;
        const functionSection = this.#module.functionSection;
        const codeSection = this.#module.codeSection;
        functionSection?.typeIdxs.forEach((typeIdx, i)=>{
            const func = new WasmFunction(typeSection.funcTypes[typeIdx], codeSection.codes[i]);
            this.#context.functions.push(func);
        });
        const exportSection = this.#module.exportSection;
        exportSection?.exports.forEach((exp)=>{
            if (exp.exportDesc?.tag === 0) {
                this.#exports[exp.name] = (...args)=>{
                    const result = this.#context.functions[exp.exportDesc.index].invoke(this.#context, ...args);
                    return result;
                };
            }
        });
    }
}
class ModuleNode {
    sections = [];
    get typeSection() {
        return this.sections.find((sec)=>sec instanceof TypeSectionNode
        );
    }
    get exportSection() {
        return this.sections.find((sec)=>sec instanceof ExportSectionNode
        );
    }
    get functionSection() {
        return this.sections.find((sec)=>sec instanceof FunctionSectionNode
        );
    }
    get codeSection() {
        return this.sections.find((sec)=>sec instanceof CodeSectionNode
        );
    }
    instantiate() {
        const inst = new Instance(this);
        inst.compile();
        return inst;
    }
    load(buffer) {
        this.magic = buffer.readBytes(4);
        this.version = buffer.readBytes(4);
        while(true){
            if (buffer.eof) break;
            const section = this.loadSection(buffer);
            this.sections.push(section);
        }
    }
    loadSection(buffer) {
        const sectionId = buffer.readByte();
        const sectionSize = buffer.readU32();
        const sectionsBuffer = buffer.readBuffer(sectionSize);
        const section = SectionNode.create(sectionId);
        section.load(sectionsBuffer);
        return section;
    }
    store(buffer) {
        if (this.magic) buffer.writeBytes(this.magic);
        if (this.version) buffer.writeBytes(this.version);
        for (const section of this.sections){
            section.store(buffer);
        }
    }
}
class SectionNode {
    static create(sectionId) {
        switch(sectionId){
            case 1:
                return new TypeSectionNode();
            case 3:
                return new FunctionSectionNode();
            case 7:
                return new ExportSectionNode();
            case 10:
                return new CodeSectionNode();
            default:
                throw new Error(`invaild section id: ${sectionId}`);
        }
    }
}
class TypeSectionNode extends SectionNode {
    funcTypes = [];
    load(buffer) {
        this.funcTypes = buffer.readVec(()=>{
            const functype = new FuncTypeNode();
            functype.load(buffer);
            return functype;
        });
    }
    store(buffer) {
        buffer.writeByte(1);
        const sectionsBuffer = new Buffer({
            buffer: new ArrayBuffer(1024)
        });
        sectionsBuffer.writeVec(this.funcTypes, (funcType)=>{
            funcType.store(sectionsBuffer);
        });
        buffer.append(sectionsBuffer);
    }
}
class FuncTypeNode {
    static get TAG() {
        return 96;
    }
    paramType = new ResultTypeNode();
    resultType = new ResultTypeNode();
    load(buffer) {
        if (buffer.readByte() !== FuncTypeNode.TAG) {
            throw new Error("invalid functype");
        }
        this.paramType = new ResultTypeNode();
        this.paramType.load(buffer);
        this.resultType = new ResultTypeNode();
        this.resultType.load(buffer);
    }
    store(buffer) {
        buffer.writeByte(FuncTypeNode.TAG);
        this.paramType.store(buffer);
        this.resultType.store(buffer);
    }
}
class ResultTypeNode {
    valTypes = [];
    load(buffer) {
        this.valTypes = buffer.readVec(()=>{
            return buffer.readByte();
        });
    }
    store(buffer) {
        buffer.writeVec(this.valTypes, (valType)=>{
            buffer.writeByte(valType);
        });
    }
}
class ExportSectionNode extends SectionNode {
    exports = [];
    load(buffer) {
        this.exports = buffer.readVec(()=>{
            const ex = new ExportNode();
            ex.load(buffer);
            return ex;
        });
    }
    store(buffer) {
        buffer.writeByte(7);
        const sectionsBuffer = new Buffer({
            buffer: new ArrayBuffer(1024)
        });
        sectionsBuffer.writeVec(this.exports, (ex)=>{
            ex.store(sectionsBuffer);
        });
        buffer.append(sectionsBuffer);
    }
}
class ExportNode {
    load(buffer) {
        this.name = buffer.readName();
        this.exportDesc = new ExportDescNode();
        this.exportDesc.load(buffer);
    }
    store(buffer) {
        buffer.writeName(this.name);
        this.exportDesc.store(buffer);
    }
}
class ExportDescNode {
    load(buffer) {
        this.tag = buffer.readByte();
        this.index = buffer.readU32();
    }
    store(buffer) {
        buffer.writeByte(this.tag);
        buffer.writeU32(this.index);
    }
}
class FunctionSectionNode extends SectionNode {
    typeIdxs = [];
    load(buffer) {
        this.typeIdxs = buffer.readVec(()=>{
            return buffer.readU32();
        });
    }
    store(buffer) {
        buffer.writeByte(3);
        const sectionsBuffer = new Buffer({
            buffer: new ArrayBuffer(1024)
        });
        sectionsBuffer.writeVec(this.typeIdxs, (typeIdx)=>{
            sectionsBuffer.writeU32(typeIdx);
        });
        buffer.append(sectionsBuffer);
    }
}
class CodeSectionNode extends SectionNode {
    codes = [];
    load(buffer) {
        this.codes = buffer.readVec(()=>{
            const code = new CodeNode();
            code.load(buffer);
            return code;
        });
    }
    store(buffer) {
        buffer.writeByte(10);
        const sectionsBuffer = new Buffer({
            buffer: new ArrayBuffer(1024)
        });
        sectionsBuffer.writeVec(this.codes, (code)=>{
            code.store(sectionsBuffer);
        });
        buffer.append(sectionsBuffer);
    }
}
class CodeNode {
    load(buffer) {
        this.size = buffer.readU32();
        const funcBuffer = buffer.readBuffer(this.size);
        this.func = new FuncNode();
        this.func.load(funcBuffer);
    }
    store(buffer) {
        const funcBuffer = new Buffer({
            buffer: new ArrayBuffer(1024)
        });
        this.func?.store(funcBuffer);
        buffer.append(funcBuffer);
    }
}
class FuncNode {
    localses = [];
    load(buffer) {
        this.localses = buffer.readVec(()=>{
            const locals = new LocalsNode();
            locals.load(buffer);
            return locals;
        });
        this.expr = new ExprNode();
        this.expr.load(buffer);
    }
    store(buffer) {
        buffer.writeVec(this.localses, (locals)=>{
            locals.store(buffer);
        });
        this.expr?.store(buffer);
    }
}
class LocalsNode {
    load(buffer) {
        this.num = buffer.readU32();
        this.valType = buffer.readByte();
    }
    store(buffer) {
        buffer.writeU32(this.num);
        buffer.writeByte(this.valType);
    }
}
class ExprNode {
    instrs = [];
    load(buffer) {
        while(true){
            const opcode = buffer.readByte();
            if (opcode === Op.End || opcode === Op.Else) {
                this.endOp = opcode;
                break;
            }
            const instr = InstrNode.create(opcode);
            if (!instr) {
                throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
            }
            instr.load(buffer);
            this.instrs.push(instr);
            if (buffer.eof) break;
        }
    }
    store(buffer) {
        for (const instr of this.instrs){
            instr.store(buffer);
        }
        buffer.writeByte(this.endOp);
    }
}
class InstrNode {
    static create(opcode) {
        switch(opcode){
            case Op.If:
                return new IfInstrNode(opcode);
            case Op.Block:
                return new BlockInstrNode(opcode);
            case Op.Loop:
                return new LoopInstrNode(opcode);
            case Op.Br:
                return new BrInstrNode(opcode);
            case Op.BrIf:
                return new BrIfInstrNode(opcode);
            case Op.Call:
                return new CallInstrNode(opcode);
            case Op.I32Const:
                return new I32ConstInstrNode(opcode);
            case Op.I32Eqz:
                return new I32EqzInstrNode(opcode);
            case Op.I32Add:
                return new I32AddInstrNode(opcode);
            case Op.I32LtS:
                return new I32LtSInstrNode(opcode);
            case Op.I32GeS:
                return new I32GeSInstrNode(opcode);
            case Op.I32RemS:
                return new I32RemSInstrNode(opcode);
            case Op.LocalGet:
                return new LocalGetInstrNode(opcode);
            case Op.LocalSet:
                return new LocalSetInstrNode(opcode);
            default:
                return null;
        }
    }
    constructor(opcode){
        this.opcode = opcode;
    }
    load(buffer) {
    }
    store(buffer) {
        buffer.writeByte(this.opcode);
    }
}
class I32ConstInstrNode extends InstrNode {
    load(buffer) {
        this.num = buffer.readI32();
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeI32(this.num);
    }
}
class I32AddInstrNode extends InstrNode {
}
class I32EqzInstrNode extends InstrNode {
}
class I32LtSInstrNode extends InstrNode {
}
class I32GeSInstrNode extends InstrNode {
}
class I32RemSInstrNode extends InstrNode {
}
class LocalGetInstrNode extends InstrNode {
    load(buffer) {
        this.localIdx = buffer.readU32();
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeU32(this.localIdx);
    }
}
class LocalSetInstrNode extends InstrNode {
    load(buffer) {
        this.localIdx = buffer.readU32();
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeU32(this.localIdx);
    }
}
class IfInstrNode extends InstrNode {
    load(buffer) {
        this.blockType = buffer.readByte();
        this.thenInstrs = new ExprNode();
        this.thenInstrs.load(buffer);
        if (this.thenInstrs.endOp === Op.Else) {
            this.elseInstrs = new ExprNode();
            this.elseInstrs.load(buffer);
        }
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeByte(this.blockType);
        this.thenInstrs.endOp = this.elseInstrs ? Op.Else : Op.End;
        this.thenInstrs.store(buffer);
        this.elseInstrs?.store(buffer);
    }
}
class BlockInstrNode extends InstrNode {
    load(buffer) {
        this.blockType = buffer.readByte();
        this.instrs = new ExprNode();
        this.instrs.load(buffer);
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeByte(this.blockType);
        this.instrs.store(buffer);
    }
}
class LoopInstrNode extends InstrNode {
    load(buffer) {
        this.blockType = buffer.readByte();
        this.instrs = new ExprNode();
        this.instrs.load(buffer);
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeByte(this.blockType);
        this.instrs.store(buffer);
    }
}
class BrInstrNode extends InstrNode {
    load(buffer) {
        this.labelIdx = buffer.readU32();
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeU32(this.labelIdx);
    }
}
class BrIfInstrNode extends InstrNode {
    load(buffer) {
        this.labelIdx = buffer.readU32();
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeU32(this.labelIdx);
    }
}
class CallInstrNode extends InstrNode {
    load(buffer) {
        this.funcIdx = buffer.readU32();
    }
    store(buffer) {
        super.store(buffer);
        buffer.writeU32(this.funcIdx);
    }
}
const Op = {
    If: 4,
    Block: 2,
    Loop: 3,
    Br: 12,
    BrIf: 13,
    Call: 16,
    LocalGet: 32,
    LocalSet: 33,
    I32Const: 65,
    I32Eqz: 69,
    I32LtS: 72,
    I32GeS: 78,
    I32Add: 106,
    I32RemS: 111,
    Else: 5,
    End: 11
};
class LocalValue {
    #type;
    constructor(type, value){
        this.#type = type;
        this.value = value;
    }
    store(buffer) {
        switch(this.#type){
            case 127:
                buffer.writeI32(this.value);
                break;
            default:
                throw new Error(`invalid local type: ${this.#type}`);
        }
    }
    load(buffer) {
        switch(this.#type){
            case 127:
                this.value = buffer.readI32();
                break;
            default:
                throw new Error(`invalid local type: ${this.#type}`);
        }
    }
}
class WasmFunction {
    #funcType;
    #code;
    #instructions;
    constructor(funcType, code){
        this.#funcType = funcType;
        this.#code = code;
        this.#instructions = new InstructionSeq(this.#code.func?.expr?.instrs);
    }
    invoke(context, ...args) {
        const params = [
            ...args
        ];
        const paramTypes = this.#funcType.paramType.valTypes;
        for(let i = 0; i < paramTypes.length - args.length; i++){
            const param = context.stack.readI32();
            params.push(param);
        }
        params.forEach((v, i1)=>{
            context.locals[i1] = new LocalValue(paramTypes[i1], v);
        });
        const localses = this.#code.func?.localses;
        if (localses) {
            for(let i1 = 0; i1 < localses.length; i1++){
                const locals = localses[i1];
                for(let j = 0; j < (locals.num || 0); j++){
                    context.locals.push(new LocalValue(locals.valType, 0));
                }
            }
        }
        let instr = this.#instructions.top;
        while(instr){
            instr = instr.invoke(context);
        }
        const resultTypes = this.#funcType.resultType.valTypes;
        if (resultTypes.length === 0) {
            return null;
        } else {
            switch(resultTypes[0]){
                case 127:
                    return context.stack.readI32();
                default:
                    throw new Error(`invalid result type: ${resultTypes[0]}`);
            }
        }
    }
}
class Context {
    constructor(){
        this.stack = new StackBuffer({
            buffer: new ArrayBuffer(1024)
        });
        this.functions = [];
        this.locals = [];
    }
}
class Instruction {
    #next;
    get next() {
        if (this.#next) {
            return this.#next;
        } else {
            return this.parent?.next;
        }
    }
    set next(instr) {
        this.#next = instr;
    }
    constructor(parent1){
        this.parent = parent1;
    }
    static create(node, parent) {
        if (node instanceof I32ConstInstrNode) {
            return new I32ConstInstruction(node, parent);
        } else if (node instanceof I32EqzInstrNode) {
            return new I32EqzInstruction(node, parent);
        } else if (node instanceof I32LtSInstrNode) {
            return new I32LtSInstruction(node, parent);
        } else if (node instanceof I32GeSInstrNode) {
            return new I32GeSInstruction(node, parent);
        } else if (node instanceof I32AddInstrNode) {
            return new I32AddInstruction(node, parent);
        } else if (node instanceof I32RemSInstrNode) {
            return new I32RemSInstruction(node, parent);
        } else if (node instanceof LocalGetInstrNode) {
            return new LocalGetInstruction(node, parent);
        } else if (node instanceof LocalSetInstrNode) {
            return new LocalSetInstruction(node, parent);
        } else if (node instanceof IfInstrNode) {
            return new IfInstruction(node, parent);
        } else if (node instanceof BlockInstrNode) {
            return new BlockInstruction(node, parent);
        } else if (node instanceof LoopInstrNode) {
            return new LoopInstruction(node, parent);
        } else if (node instanceof BrInstrNode) {
            return new BrInstruction(node, parent);
        } else if (node instanceof BrIfInstrNode) {
            return new BrIfInstruction(node, parent);
        } else if (node instanceof CallInstrNode) {
            return new CallInstruction(node, parent);
        } else {
            throw new Error(`invalid node: ${node.constructor.name}`);
        }
    }
    invoke(context) {
        throw new Error(`subclass responsibility; ${this.constructor.name}`);
    }
}
class InstructionSeq extends Instruction {
    #instructions=[];
    get top() {
        return this.#instructions[0];
    }
    constructor(nodes = [], parent2){
        super();
        if (nodes.length === 0) return;
        let prev = Instruction.create(nodes[0], parent2);
        this.#instructions.push(prev);
        for(let i = 1; i < nodes.length; i++){
            prev.next = Instruction.create(nodes[i], parent2);
            this.#instructions.push(prev);
            prev = prev.next;
        }
    }
    invoke(context) {
        return this.top;
    }
}
class LocalGetInstruction extends Instruction {
    #localIdx;
    constructor(node, parent3){
        super(parent3);
        this.#localIdx = node.localIdx;
    }
    invoke(context) {
        const local = context.locals[this.#localIdx];
        local.store(context.stack);
        return this.next;
    }
}
class LocalSetInstruction extends Instruction {
    #localIdx;
    constructor(node1, parent4){
        super(parent4);
        this.#localIdx = node1.localIdx;
    }
    invoke(context) {
        const local = context.locals[this.#localIdx];
        local.load(context.stack);
        return this.next;
    }
}
class I32ConstInstruction extends Instruction {
    #num;
    constructor(node2, parent5){
        super(parent5);
        this.#num = node2.num;
    }
    invoke(context) {
        context.stack.writeI32(this.#num);
        return this.next;
    }
}
class I32EqzInstruction extends Instruction {
    constructor(node3, parent6){
        super(parent6);
    }
    invoke(context) {
        const num = context.stack.readS32();
        context.stack.writeI32(num === 0 ? 1 : 0);
        return this.next;
    }
}
class I32LtSInstruction extends Instruction {
    constructor(node4, parent7){
        super(parent7);
    }
    invoke(context) {
        const rhs = context.stack.readS32();
        const lhs = context.stack.readS32();
        context.stack.writeI32(lhs < rhs ? 1 : 0);
        return this.next;
    }
}
class I32GeSInstruction extends Instruction {
    constructor(node5, parent8){
        super(parent8);
    }
    invoke(context) {
        const rhs = context.stack.readS32();
        const lhs = context.stack.readS32();
        context.stack.writeI32(lhs >= rhs ? 1 : 0);
        return this.next;
    }
}
class I32AddInstruction extends Instruction {
    constructor(node6, parent9){
        super(parent9);
    }
    invoke(context) {
        const rhs = context.stack.readI32();
        const lhs = context.stack.readI32();
        context.stack.writeI32(lhs + rhs);
        return this.next;
    }
}
class I32RemSInstruction extends Instruction {
    constructor(node7, parent10){
        super(parent10);
    }
    invoke(context) {
        const rhs = context.stack.readS32();
        const lhs = context.stack.readS32();
        context.stack.writeS32(lhs % rhs);
        return this.next;
    }
}
class IfInstruction extends Instruction {
    #thenInstructions;
    #elseInstructions;
    constructor(node8, parent11){
        super(parent11);
        this.#thenInstructions = new InstructionSeq(node8.thenInstrs.instrs, this);
        this.#elseInstructions = new InstructionSeq(node8.elseInstrs?.instrs, this);
    }
    invoke(context) {
        const cond = context.stack.readI32();
        if (cond !== 0) {
            return this.#thenInstructions;
        } else {
            return this.#elseInstructions;
        }
    }
    branchIn() {
        return this.next;
    }
}
class BlockInstruction extends Instruction {
    #instructions;
    constructor(node9, parent12){
        super(parent12);
        this.#instructions = new InstructionSeq(node9.instrs.instrs, this);
    }
    invoke(context) {
        return this.#instructions.top;
    }
    branchIn() {
        return this.next;
    }
}
class LoopInstruction extends Instruction {
    #instructions;
    constructor(node10, parent13){
        super(parent13);
        this.#instructions = new InstructionSeq(node10.instrs.instrs, this);
    }
    invoke(context) {
        return this.#instructions.top;
    }
    branchIn() {
        return this.#instructions.top;
    }
}
class BrInstruction extends Instruction {
    #labelIdx;
    constructor(node11, parent14){
        super(parent14);
        this.#labelIdx = node11.labelIdx;
    }
    invoke(context) {
        let label = 0;
        let parent15 = this.parent;
        while(parent15){
            if (parent15 instanceof IfInstruction || parent15 instanceof BlockInstruction || parent15 instanceof LoopInstruction) {
                if (label === this.#labelIdx) {
                    return parent15.branchIn();
                }
                label++;
            }
            parent15 = parent15.parent;
        }
        throw new Error(`branch error: ${this.#labelIdx} ${label}`);
    }
}
class BrIfInstruction extends BrInstruction {
    constructor(node12, parent15){
        super(node12, parent15);
    }
    invoke(context) {
        const cond = context.stack.readI32();
        if (cond === 0) {
            return this.next;
        }
        return super.invoke(context);
    }
}
class CallInstruction extends Instruction {
    #funcIdx;
    constructor(node13, parent16){
        super(parent16);
        this.#funcIdx = node13.funcIdx;
    }
    invoke(context) {
        const func = context.functions[this.#funcIdx];
        const result = func.invoke(context);
        if (result) {
            context.stack.writeI32(result);
        }
        return this.next;
    }
}
export { ModuleNode as WasmModule };
export { Buffer as WasmBuffer };

