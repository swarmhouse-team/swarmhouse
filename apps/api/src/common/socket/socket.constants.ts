/** Engine path. Nest's HTTP prefix does not apply to Socket.IO. */
export const SOCKET_ENGINE_PATH = '/api/socket.io';

/** Transport frame limit for every Socket.IO namespace in this process. */
export const SOCKET_MAX_HTTP_BUFFER_BYTES = 16 * 1024;
