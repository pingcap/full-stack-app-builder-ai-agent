import type { Readable } from 'node:stream';
import type { StreamConfig, StreamState } from '../db/stream.v2.ts';

export interface StreamMetadata {
  config: StreamConfig;
  state: StreamState;
}

export interface ReadStreamProvider {
  getStreamInfo (id: string): Promise<StreamMetadata | null>;

  createReadStream (metadata: StreamMetadata): Readable;

  save (metadata: StreamMetadata, readable: AsyncIterable<Buffer>): Promise<void>;

  cleanup (id: string): Promise<void>
}

export interface StreamProviderHelpers {
  readonly streams: Readonly<Record<'fs' | 'redis', ReadStreamProvider>>;
}
