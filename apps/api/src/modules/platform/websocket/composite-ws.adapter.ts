import { INestApplicationContext, WebSocketAdapter } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WsAdapter } from '@nestjs/platform-ws';
import { MessageMappingProperties } from '@nestjs/websockets';
import { Observable } from 'rxjs';

export class CompositeWebSocketAdapter implements WebSocketAdapter {
  private readonly wsAdapter: WsAdapter;
  private readonly ioAdapter: IoAdapter;
  private readonly serverAdapterMap = new WeakMap<any, WebSocketAdapter>();
  private readonly clientAdapterMap = new WeakMap<any, WebSocketAdapter>();

  constructor(app: INestApplicationContext) {
    this.wsAdapter = new WsAdapter(app);
    this.ioAdapter = new IoAdapter(app);
  }

  create(port: number, options?: any): any {
    const isWs = options?.path === '/voice' || options?.adapter === 'ws';
    const chosenAdapter = isWs ? this.wsAdapter : this.ioAdapter;
    const server = chosenAdapter.create(port, options);
    this.serverAdapterMap.set(server, chosenAdapter);
    return server;
  }

  bindClientConnect(server: any, callback: (...args: any[]) => void): void {
    const adapter = this.serverAdapterMap.get(server) || this.ioAdapter;
    adapter.bindClientConnect(server, (client: any, ...rest: any[]) => {
      this.clientAdapterMap.set(client, adapter);
      callback(client, ...rest);
    });
  }

  bindClientDisconnect(client: any, callback: (...args: any[]) => void): void {
    const adapter = this.clientAdapterMap.get(client) || this.ioAdapter;
    if (adapter.bindClientDisconnect) {
      adapter.bindClientDisconnect(client, callback);
    }
  }

  bindMessageHandlers(
    client: any,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ): void {
    const adapter = this.clientAdapterMap.get(client) || this.ioAdapter;
    adapter.bindMessageHandlers(client, handlers, process);
  }

  close(server: any): void {
    const adapter = this.serverAdapterMap.get(server) || this.ioAdapter;
    adapter.close(server);
  }
}
