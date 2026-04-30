import type { IncomingMessage, ServerResponse } from "node:http";

const GITHUB_API_VERSION = "2022-11-28";

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type GithubContentResponse = {
  content?: string;
  sha: string;
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const filePath = process.env.GITHUB_FILE_PATH;

  if (!token || !owner || !repo || !filePath) {
    return null;
  }

  return { token, owner, repo, filePath };
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

async function readBody(req: VercelRequest): Promise<unknown> {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

async function fetchGithubFile(config: NonNullable<ReturnType<typeof getConfig>>) {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
    config.repo,
  )}/contents/${config.filePath}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub read failed with status ${response.status}`);
  }

  return (await response.json()) as GithubContentResponse;
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  const config = getConfig();

  if (!config) {
    return json(res, 500, { error: "GitHub storage is not configured." });
  }

  try {
    if (req.method === "GET") {
      const file = await fetchGithubFile(config);
      const parsed = JSON.parse(decodeBase64(String(file.content ?? "").replace(/\n/g, "")));
      return json(
        res,
        200,
        parsed && typeof parsed === "object"
          ? parsed
          : { items: [], desktop: { layout: [], folders: [] } },
      );
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const data = (body as { data?: unknown })?.data ?? body;

      if (!data || typeof data !== "object") {
        return json(res, 400, { error: "Request body must be a JSON object." });
      }

      const file = await fetchGithubFile(config);
      const content = encodeBase64(`${JSON.stringify(data, null, 2)}\n`);
      const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
        config.repo,
      )}/contents/${config.filePath}`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
        body: JSON.stringify({
          message: "update data",
          content,
          sha: file.sha,
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub write failed with status ${response.status}`);
      }

      return json(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub storage request failed.";
    return json(res, 502, { error: message });
  }
}
