export const WAREHOUSE_SOCKET_NAMESPACE = '/warehouse';
export const WAREHOUSE_SOCKET_PATH = '/api/socket.io';
export const WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS = 20;
export const WAREHOUSE_SOCKET_MAX_PAYLOAD_BYTES = 16 * 1024;

/** Room name is chosen by the server. The client never sends it. */
export function warehouseRoom(warehouseId: string): string {
  return `warehouse:${warehouseId}`;
}

export function warehousePayloadBytes(payload: unknown): number {
  const encoded = JSON.stringify(payload);
  if (encoded === undefined) {
    return 0;
  }
  return Buffer.byteLength(encoded);
}
