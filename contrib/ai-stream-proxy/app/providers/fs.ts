import * as fs from 'node:fs';
import path from 'node:path';
import * as stream from 'node:stream';
import { Readable } from 'node:stream';
import env from '../utils/env.ts';
import type { ReadStreamProvider, StreamMetadata } from './read-stream-provider.ts';

export function getFSStreamProvider (): ReadStreamProvider {
  const base = path.join(env.DATA_PATH, 'streams');

  const metaPath = path.join(base, 'meta');
  const contentPath = path.join(base, 'content');

  return {
    async getStreamInfo (id: string): Promise<StreamMetadata | null> {
      id = encodeURIComponent(id);
      try {
        const [metaContent] = await Promise.all([
          fs.promises.readFile(path.join(metaPath, id + '.json'), 'utf-8'),
          fs.promises.access(path.join(contentPath, id), fs.constants.R_OK),
        ]);
        return JSON.parse(metaContent) as StreamMetadata;
      } catch {
        return null;
      }
    },
    createReadStream (metadata: StreamMetadata): Readable {
      return fs.createReadStream(path.join(contentPath, encodeURIComponent(metadata.config.stream_id)));
    },
    async save (metadata: StreamMetadata, readable: AsyncIterable<Buffer>): Promise<void> {
      await Promise.all([
        fs.promises.mkdir(metaPath, { recursive: true }),
        fs.promises.mkdir(contentPath, { recursive: true }),
      ]);

      const basename = encodeURIComponent(metadata.config.stream_id);

      const ws = fs.createWriteStream(path.join(contentPath, basename));
      await stream.promises.finished(Readable.from(readable).pipe(ws));
      await fs.promises.writeFile(path.join(metaPath, basename + '.json'), JSON.stringify(metadata, undefined, 2));
    },
    async cleanup (id) {
      const basename = encodeURIComponent(id);
      await Promise.allSettled([
        fs.promises.rm(path.join(contentPath, basename)),
        fs.promises.rm(path.join(metaPath, basename + '.json')),
      ]);
    },
  };
}

