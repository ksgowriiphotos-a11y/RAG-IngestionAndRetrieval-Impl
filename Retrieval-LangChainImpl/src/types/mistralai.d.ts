declare module '@mistralai/mistralai' {
  export default class MistralClient {
    constructor(apiKey?: string, endpoint?: string);
    listModels(): Promise<any>;
    chat(opts: any): Promise<any>;
    chatStream(opts: any): AsyncGenerator<any>;
    embeddings(opts: { model: string; input: string | string[] }): Promise<{ data: Array<{ embedding: number[] }> }>;
  }
}