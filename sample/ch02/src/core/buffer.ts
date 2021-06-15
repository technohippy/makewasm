export class Buffer {
  #cursor = 0
  #buffer: ArrayBuffer

  constructor({buffer}:{buffer:ArrayBuffer}) {
    this.#buffer = buffer
  }

  // module.wasm
  readBytes(size:number): Uint8Array {
    if (this.#buffer.byteLength < this.#cursor+size) {
      return new Uint8Array(0)
    }

    const slice = this.#buffer.slice(this.#cursor, this.#cursor+size)
    this.#cursor += size
    return new Uint8Array(slice)
  }

  // const.wasm
  get byteLength(): number {
    return this.#buffer.byteLength
  }

  get eof(): boolean {
    return this.byteLength <= this.#cursor
  }

  readByte(): number {
    const bytes = this.readBytes(1)
    if (bytes.length <= 0) {
      return -1
    }
    return bytes[0]
  }
  
  readBuffer(size:number=this.#buffer.byteLength-this.#cursor): Buffer {
    return new Buffer(this.readBytes(size))
  }

  readU32(): number{
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readByte()
      result |= (byte & 0b01111111) << shift;
      shift += 7;
      if ((0b10000000 & byte) === 0) {
        return result;
      }
    }
  }

  readS32(): number {
    // https://en.wikipedia.org/wiki/LEB128#Decode_signed_32-bit_integer
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readByte()
      result |= (byte & 0b01111111) << shift;
      shift += 7;
      if ((0b10000000 & byte) === 0) {
        if (shift < 32 && (byte & 0b01000000) !== 0) {
          return result | (~0 << shift);
        }
        return result;
      }
    }
  }
  
  readI32(): number {
    return this.readS32()
  }

  readVec<T>(readT:()=>T): T[] {
    const vec = []
    const size = this.readU32()
    for (let i = 0; i < size; i++) {
      vec.push(readT())
    }
    return vec
  }

  readName(): string {
    const size = this.readU32()
    const bytes = this.readBytes(size)
    return new TextDecoder("utf-8").decode(bytes.buffer)
  }
}