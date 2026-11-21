export type SseMessage = { event: string | null; data: string };

/**
 * Incremental Server-Sent Events parser.
 *
 * Streaming responses arrive in arbitrary chunks, so the parser keeps a buffer and
 * only emits a message when the blank-line delimiter is complete. Pure function of
 * its input, which makes it testable without a network.
 */
export function createSseParser(): (chunk: string) => SseMessage[] {
  let buffer = '';

  return (chunk: string): SseMessage[] => {
    buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const messages: SseMessage[] = [];

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const rawMessage = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      let event: string | null = null;
      const dataLines: string[] = [];
      for (const line of rawMessage.split('\n')) {
        if (line.startsWith(':') || line.trim() === '') continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') dataLines.push(value);
      }
      if (dataLines.length > 0) messages.push({ event, data: dataLines.join('\n') });

      separatorIndex = buffer.indexOf('\n\n');
    }

    return messages;
  };
}
