import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { ISOLATION_HEADERS } from './site_config.ts';

export interface Server {
  /** `http://127.0.0.1:<port>`; each Variant's site is under `/<variant>/`. */
  origin: string;
  close: () => Promise<void>;
}

// A Vite build of the Scenario pages emits only these.
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

/** Serves the built sites in `root` over loopback with the cross-origin isolation headers. */
export async function serve(root: string): Promise<Server> {
  const rootPrefix = root.endsWith(sep) ? root : root + sep;
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const path = normalize(join(root, pathname));
      if (!path.startsWith(rootPrefix)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(path);
      response.writeHead(200, {
        ...ISOLATION_HEADERS,
        'Content-Type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      // A missing file, or a request URL that does not decode.
      response.writeHead(404).end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
