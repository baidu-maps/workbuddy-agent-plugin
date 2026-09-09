#!/usr/bin/env node
/**
 * baidu-maps-docs MCP stdio proxy
 *
 * Credentials must never be embedded in the plugin package, and MCP `url` /
 * `headers` fields cannot carry placeholders resolved at install time. The
 * upstream baidu-maps-docs server authenticates via an `?ak=` query parameter,
 * so it cannot be declared as a `streamable-http` entry in docs.mcp.json.
 *
 * This proxy speaks MCP stdio to the client and Streamable HTTP to the upstream,
 * resolving the AK at runtime from the environment or the local bmap-cli login
 * state. Hosts may filter arbitrary environment variables for plugin MCP
 * subprocesses, so the primary path is the bmap-cli login state under HOME.
 * The AK is never written to the plugin package or to stdout.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const UPSTREAM =
  process.env.BAIDU_MAPS_DOCS_UPSTREAM || 'https://docs.map.baidu.com/mcp/';

const log = (...args) => process.stderr.write(`[baidu-maps-docs] ${args.join(' ')}\n`);

/** Locate the bmap-cli binary without assuming it is on PATH. */
function findCli() {
  if (process.env.BMAP_CLI && existsSync(process.env.BMAP_CLI)) {
    return process.env.BMAP_CLI;
  }
  const os = { darwin: 'darwin', linux: 'linux' }[process.platform] || process.platform;
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch] || process.arch;
  const candidates = [
    join(homedir(), 'bin', `bmap-cli-${os}-${arch}`),
    join(homedir(), 'bin', 'bmap-cli'),
    join(homedir(), '.local', 'bin', 'bmap-cli'),
  ];
  return candidates.find(existsSync) || 'bmap-cli';
}

/**
 * Resolve an AK for the docs endpoint.
 * Order: explicit override -> generic env -> server-side AK from bmap-cli.
 */
function resolveAk() {
  const fromEnv = process.env.BAIDU_MAPS_DOCS_AK || process.env.BMAP_AK;
  if (fromEnv) return fromEnv;

  const cli = findCli();
  const res = spawnSync(cli, ['ak', 'list', '--json'], {
    encoding: 'utf8',
    timeout: 20_000,
  });
  const updateOutput = [res.stderr, res.stdout]
    .filter(Boolean)
    .find((output) => output.includes('发现新版本'));
  if (updateOutput) {
    const updateLines = updateOutput
      .split(/\r?\n/)
      .filter((line) =>
        line.includes('发现新版本') ||
        /(?:curl|wget|bmap-cli).*(?:open-agent-cli\.bj\.bcebos\.com|更新|upgrade|update)/i.test(line)
      );
    throw new Error(
      'bmap-cli 发现新版本，已按安全规则暂停。请先向用户完整展示更新命令和下载域名' +
        ' open-agent-cli.bj.bcebos.com，取得明确同意后再更新并重试。' +
        (updateLines.length ? `\n${updateLines.join('\n')}` : '')
    );
  }
  if (res.status !== 0) {
    const detail = res.error?.message ? `：${res.error.message}` : '';
    throw new Error(
      `无法从 bmap-cli 获取 AK（exit ${res.status}${detail}）。` +
        `请先通过 baidu-map:bmap-cli skill 完成登录。` +
        `Plugin MCP 子进程可能不会继承宿主的 AK 环境变量。`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    throw new Error('bmap-cli ak list 输出不是合法 JSON，无法解析 AK。');
  }
  const list = Array.isArray(parsed?.data) ? parsed.data : [];
  const usable = list.filter((a) => a?.ak && a?.status === '正常');
  const picked =
    usable.find((a) => a.app_type === '服务端') || usable[0];
  if (!picked) {
    throw new Error(
      '当前账号下没有可用 AK。请在百度地图开放平台创建一个服务端 AK 后重试。'
    );
  }
  return picked.ak;
}

let cachedUrl = null;
function upstreamUrl() {
  if (cachedUrl) return cachedUrl;
  const ak = resolveAk();
  const url = new URL(UPSTREAM);
  url.searchParams.set('ak', ak);
  cachedUrl = url.toString();
  return cachedUrl;
}

/** Session id assigned by the upstream server, if it uses one. */
let sessionId = null;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function errorFor(id, message) {
  return { jsonrpc: '2.0', id, error: { code: -32603, message } };
}

/** Parse an upstream response body that may be JSON or an SSE stream. */
function parseBody(contentType, text) {
  if (!text) return [];
  if (contentType.includes('text/event-stream')) {
    const messages = [];
    for (const chunk of text.split(/\n\n+/)) {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          messages.push(JSON.parse(payload));
        } catch {
          /* ignore malformed SSE frame */
        }
      }
    }
    return messages;
  }
  try {
    return [JSON.parse(text)];
  } catch {
    return [];
  }
}

async function forward(request) {
  const isNotification = request.id === undefined || request.id === null;
  let url;
  try {
    url = upstreamUrl();
  } catch (err) {
    if (isNotification) {
      log(err.message);
      return;
    }
    send(errorFor(request.id, err.message));
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
  } catch (err) {
    if (isNotification) {
      log(`上游请求失败：${err.message}`);
      return;
    }
    send(errorFor(request.id, `连接百度地图文档服务失败：${err.message}`));
    return;
  }

  const upstreamSession = res.headers.get('mcp-session-id');
  if (upstreamSession) sessionId = upstreamSession;

  const text = await res.text();

  if (!res.ok) {
    if (isNotification) {
      log(`上游返回 HTTP ${res.status}`);
      return;
    }
    send(
      errorFor(
        request.id,
        `百度地图文档服务返回 HTTP ${res.status}。若为 401/403，请确认 AK 已开通文档服务权限。`
      )
    );
    return;
  }

  for (const message of parseBody(res.headers.get('Content-Type') || '', text)) {
    send(message);
  }
}

const queue = [];
let draining = false;
let stdinClosed = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    await forward(queue.shift());
  }
  draining = false;
  if (stdinClosed) process.exit(0);
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    log('收到非法 JSON-RPC 消息，已忽略。');
    return;
  }
  queue.push(request);
  void drain();
});
rl.on('close', () => {
  stdinClosed = true;
  if (!draining && queue.length === 0) process.exit(0);
});
