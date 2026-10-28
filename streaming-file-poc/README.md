# streaming-file-poc

Upload once, stream anywhere. A zero-dependency Node + browser prototype for link-started file streaming.

> Scope note: this is a conventional file-server prototype (upload -> store -> stream link).
> It is NOT the "publish without a server" comment-chain POC from the original request -
> that design splits a file into text chunks published as a chained set of public text posts
> and reconstructs it from the chain's first link. This prototype covers only the adjacent
> building blocks: ordered chunk assembly in the browser, progress/throughput UI, and
> stream-to-disk writing.

1. Upload a file through the web UI (or use the built-in 50MB demo).
2. The server stores it and returns a **stream link** - a URL pointing at the start of the byte stream.
3. Paste the link into the text field on the page. The browser fetches it and **builds the file chunk by chunk** as bytes arrive, with a live progress bar and throughput sparkline. The server stores the uploaded file (it is the stream source). On the client side there are two sink modes: the File System Access mode writes each chunk straight to disk and never holds the whole file in memory, while the default Blob fallback assembles all chunks in memory and saves once at the end.

## Run

```bash
node server.mjs          # serves http://localhost:4173
node make-demo.mjs       # creates data/demo50--demo-content-50mb.txt (deterministic 50MB)
```

Open http://localhost:4173, click **Use the 50MB demo instead** (or upload your own file), then **Start streaming**.

## How it works

- `POST /api/upload` streams the request body straight to disk (`x-file-name` header carries the name) and answers with `{ id, name, size, streamUrl }`.
- `GET /stream/:id/:name` streams the stored file with `Content-Length`, `Accept-Ranges: bytes`, and working `Range` support (HTTP 206), CORS-open so the link works from any origin.
- The browser client uses `fetch` + `ReadableStream.getReader()` to assemble chunks **in order**. Two sink modes:
  - **Memory** (default): chunks collected into a `Blob`, then a classic anchor download. Simple and works everywhere, but the full file sits in RAM until the end.
  - **Straight to disk**: `showSaveFilePicker` + `FileSystemWritableFileStream.write()` per chunk, so a 50MB file never occupies 50MB of RAM (Chrome/Edge; checkbox in the UI).
- A sparkline canvas plots rolling MB/s while streaming.

## Verified (Oct 28, 2026, local)

| Check | Result |
| --- | --- |
| Upload -> stream round-trip, 3MB random binary | 3,145,728 bytes, sha256 exact match |
| Range request `bytes=100-199` | HTTP 206, exactly 100 bytes |
| 50MB demo streamed via the Node verifier AND downloaded in Chrome canary 158 through the real UI | 52,428,808 bytes, matches server sha256 `f20e880199eb4dd80da0aa5d7ce56ec319b1b7eb13a676152f15980960b63076` |

The 207 MB/s figure is loopback; on a real network the bottleneck is the link, which is exactly what the progress bar and sparkline are for. Local-only POC: no auth, no TLS - do not expose as-is.
