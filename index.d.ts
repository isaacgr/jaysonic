import { EventEmitter } from "events";

export interface ClientOptions {
  version?: number;
  delimiter?: string;
  timeout?: number;
  connectionTimeout?: number;
  retries?: number;
}

export interface TcpClientOptions extends ClientOptions {
  host?: string;
  port?: number;
}

export interface HttpClientOptions extends ClientOptions {
  host?: string;
  port?: number;
  encoding?: string;
  method?: string;
  headers?: object;
  path?: string;
  scheme?: string;
}

export interface WsClientOptions extends ClientOptions {
  url?: string;
}

export declare class TcpClient extends client {
  constructor(options?: TcpClientOptions);
}

export declare class HttpClient extends client {
  constructor(options?: TcpClientOptions);
}

export declare class WsClient extends client {
  constructor(options?: TcpClientOptions);
}

export declare class client extends EventEmitter {
  constructor(options?: ClientOptions);

  static tcp(options?: TcpClientOptions): TcpClient;
  static http(options?: HttpClientOptions): HttpClient;
  static ws(options?: WsClientOptions): WsClient;
}
