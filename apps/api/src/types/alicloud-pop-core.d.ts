declare module '@alicloud/pop-core' {
  interface ClientConfig {
    accessKeyId: string;
    accessKeySecret: string;
    endpoint: string;
    apiVersion: string;
  }

  interface RequestOptions {
    method?: string;
  }

  export default class Core {
    constructor(config: ClientConfig);
    request(action: string, params: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
  }
}
