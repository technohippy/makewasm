export class WasmModule {
  code:string

  constructor(code: Uint8Array) {
    this.code = new TextDecoder("utf-8").decode(code);
  }
}