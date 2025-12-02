export class JsonDecoderStream<T> extends TransformStream<string, T> {
  constructor (debugName: string = 'JsonDecoderStream', {
      errorHandler = 'skip',
      onChunkError,
      onReportNotEscapedControlCharacters,
    }: {
      errorHandler?: 'skip' | 'terminate' | 'error',
      onChunkError?: (error: unknown, chunk: string) => void,
      onReportNotEscapedControlCharacters?: (code: number) => void,
    } = {},
  ) {
    super({
      transform: (chunk, controller) => {
        try {
          controller.enqueue(JSON.parse(chunk));
        } catch (e) {
          let safeChunkCharCodes: number[] = [];
          for (let i = 0; i < chunk.length; i++) {
            const code = chunk.charCodeAt(i);
            if (code < 32 || code === 127) {
              onReportNotEscapedControlCharacters?.(code);
              let escapeSequence: string;
              switch (code) {
                case 0:
                  escapeSequence = '\\0';
                  break;
                case 7:
                  escapeSequence = '\\a';
                  break;
                case 8:
                  escapeSequence = '\\b';
                  break;
                case 9:
                  escapeSequence = '\\t';
                  break;
                case 10:
                  escapeSequence = '\\n';
                  break;
                case 11:
                  escapeSequence = '\\v';
                  break;
                case 12:
                  escapeSequence = '\\f';
                  break;
                case 13:
                  escapeSequence = '\\r';
                  break;
                default:
                  escapeSequence = '\\u00' + code.toString(16).padStart(2, '0');
                  break;
              }
              // Escape sequence
              for (let j = 0; j < escapeSequence.length; j++) {
                safeChunkCharCodes.push(escapeSequence.charCodeAt(j));
              }
            } else {
              safeChunkCharCodes.push(code);
            }
          }

          try {
            const safeChunk = String.fromCharCode(...safeChunkCharCodes);
            controller.enqueue(JSON.parse(safeChunk));
          } catch (e) {
            onChunkError?.(e, chunk);
            switch (errorHandler) {
              case 'error':
                controller.error(e);
                break;
              case 'terminate':
                controller.terminate();
                break;
              case 'skip':
                break;
            }
          }
        }
      },
    });
  }
}

export class JsonEncodeStream<T> extends TransformStream<T, string> {
  constructor () {
    super({
      transform: (chunk, controller) => {
        controller.enqueue(JSON.stringify(chunk));
      },
    });
  }
}

export type TextEvent = { event: string, payload: string };

export class TextEventEncodeStream extends TransformStream<any, string> {
  constructor (createEvent: (payload: string) => TextEvent, createFlushEvent?: () => TextEvent) {
    let heartbeatHandle: any;

    super({
      start (controller) {
        rescheduleHeartbeat(controller);
      },

      transform (chunk, controller) {
        rescheduleHeartbeat(controller);
        const { event, payload } = createEvent(chunk);
        controller.enqueue(`${event}: ${payload.replace(/\n/, '\\n')}\n\n`);
      },

      flush (controller) {
        clearTimeout(heartbeatHandle);
        if (createFlushEvent) {
          const { event, payload } = createFlushEvent();
          controller.enqueue(`${event}: ${payload.replace(/\n/, '\\n')}\n\n`);
        }
      },
    });

    function rescheduleHeartbeat (controller: TransformStreamDefaultController<string>) {
      clearTimeout(heartbeatHandle);
      heartbeatHandle = setTimeout(() => {
        controller.enqueue(': heartbeat\n\n');
        rescheduleHeartbeat(controller);
      }, 5000);
    }
  }
}

export class TextEventDecodeStream extends TransformStream<string, TextEvent> {
  constructor () {
    super({
      transform (line, controller) {
        // Comment
        if (line.startsWith(':')) {
          return;
        }
        const idx = line.indexOf(':');
        if (idx === -1) {
          console.warn('Invalid line:', line);
        }

        const event = line.slice(0, idx).trim();
        const payload = line.slice(idx + 1).trim();
        controller.enqueue({ event, payload });
      },
    });
  }
}

export class BufferedLinesStream extends TransformStream<string, string> {
  constructor (sep = '\n', eofAsSep = true) {
    let buffer = '';
    super({
      transform (chunk, controller) {
        chunk = buffer += chunk;

        while (true) {
          const index = chunk.indexOf(sep);
          if (index === -1) {
            buffer = chunk;
            break;
          }

          const line = chunk.slice(0, index).trim();
          if (line) {
            controller.enqueue(line);
          }
          chunk = chunk.slice(index + sep.length);
        }
      },

      flush (controller) {
        if (buffer) {
          if (eofAsSep) {
            controller.enqueue(buffer);
          } else {
            console.warn('buffered lines stream has unprocessed lines:', buffer);
          }
        }
      },
    });
  }
}

export class ReplaceInvalidSequencesStream extends TransformStream<string, string> {
  constructor () {
    super({
      transform (chunk, controller) {
        controller.enqueue(chunk.replace(/\r/g, '\\r'));
      },
    });
  }
}