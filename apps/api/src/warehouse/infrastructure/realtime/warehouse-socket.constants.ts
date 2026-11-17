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
