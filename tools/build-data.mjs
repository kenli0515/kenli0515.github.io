#!/usr/bin/env node
// 由 projects.json（手寫 manifest）＋ GitHub API 產生 data/projects.json。
// 用法：GITHUB_TOKEN=xxx node tools/build-data.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(rootDir, 'projects.json');
const outPath = path.join(rootDir, 'data', 'projects.json');

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';

async function api(route, { raw = false } = {}) {
  const headers = {
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    'User-Agent': 'kenli0515-portal-build',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase}${route}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${route} -> ${res.status} ${await res.text()}`);
  return raw ? res.text() : res.json();
}

async function versionFromJson(repo, file) {
  const text = await api(`/repos/${repo}/contents/${file}`, { raw: true }).catch(() => null);
  if (!text) return null;
  try {
    const version = JSON.parse(text).version;
    return typeof version === 'string' && version.trim() ? { version: version.trim(), source: file } : null;
  } catch {
    return null;
  }
}

async function resolveVersion(entry, repoData) {
  if (entry.version) return { version: String(entry.version), source: 'manual' };

  for (const file of ['version.json', 'package.json']) {
    const found = await versionFromJson(entry.repo, file);
    if (found) return found;
  }

  const tags = await api(`/repos/${entry.repo}/tags?per_page=1`).catch(() => null);
  if (tags?.length) return { version: tags[0].name.replace(/^v/i, ''), source: 'tag' };

  const stamp = (repoData?.pushed_at || repoData?.created_at || '').slice(0, 10).replaceAll('-', '.');
  return stamp ? { version: stamp, source: 'date' } : { version: null, source: null };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const projects = [];

  for (const entry of manifest.projects) {
    const repoData = await api(`/repos/${entry.repo}`).catch((err) => {
      console.warn(`! ${entry.repo}: ${err.message}`);
      return null;
    });

    const { version, source } = await resolveVersion(entry, repoData);

    projects.push({
      id: entry.id,
      title: entry.title,
      emoji: entry.emoji || null,
      description: entry.description || repoData?.description || '',
      tags: entry.tags || [],
      url: entry.url,
      repo: entry.repo,
      repoUrl: repoData?.html_url || `https://github.com/${entry.repo}`,
      version,
      versionSource: source,
      updatedAt: repoData?.pushed_at || null,
      createdAt: repoData?.created_at || null,
      language: entry.language || repoData?.language || null,
      stars: repoData?.stargazers_count ?? null,
      pages: repoData?.has_pages ?? null,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    owner: manifest.owner,
    count: projects.length,
    projects,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(rootDir, outPath)} (${projects.length} projects)`);
  for (const p of projects) {
    console.log(`  ${p.id.padEnd(28)} v${p.version ?? '?'} (${p.versionSource ?? 'none'}) @ ${p.updatedAt ?? '?'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
