const DATA_URL = 'data/projects.json';

const state = {
  projects: [],
  allTags: [],
  q: '',
  tag: '',
  sort: 'updated',
};

const els = {
  grid: document.getElementById('tools'),
  empty: document.getElementById('empty'),
  error: document.getElementById('error'),
  stats: document.getElementById('stats'),
  filters: document.getElementById('tagFilters'),
  q: document.getElementById('q'),
  sort: document.getElementById('sort'),
  generatedAt: document.getElementById('generatedAt'),
  themeToggle: document.getElementById('themeToggle'),
};

init();

async function init() {
  setupTheme();
  readUrlState();

  els.q.value = state.q;
  els.sort.value = state.sort;
  els.q.addEventListener('input', () => {
    state.q = els.q.value.trim();
    writeUrlState();
    render();
  });
  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    writeUrlState();
    render();
  });

  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.projects = Array.isArray(data.projects) ? data.projects : [];
    state.allTags = [...new Set(state.projects.flatMap((p) => p.tags || []))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    renderFilters();
    renderStats(data.generatedAt);
    render();
  } catch (err) {
    console.error(err);
    els.error.hidden = false;
  }
}

function setupTheme() {
  const modes = ['auto', 'light', 'dark'];
  let mode = 'auto';
  try {
    const saved = localStorage.getItem('theme');
    if (modes.includes(saved)) mode = saved;
  } catch (e) {}
  apply(mode);

  els.themeToggle.addEventListener('click', () => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    try { localStorage.setItem('theme', mode); } catch (e) {}
    apply(mode);
  });

  function apply(next) {
    if (next === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    els.themeToggle.dataset.mode = next;
    els.themeToggle.title = { auto: '跟隨系統', light: '淺色', dark: '深色' }[next];
  }
}

function readUrlState() {
  const params = new URLSearchParams(location.search);
  state.q = params.get('q') ?? '';
  state.tag = params.get('tag') ?? '';
  const sort = params.get('sort');
  if (['updated', 'created', 'name'].includes(sort)) state.sort = sort;
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  if (state.sort !== 'updated') params.set('sort', state.sort);
  const query = params.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

function renderFilters() {
  els.filters.textContent = '';
  const tags = ['', ...state.allTags];
  for (const tag of tags) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = tag || '全部';
    btn.setAttribute('aria-pressed', String(state.tag === tag));
    btn.addEventListener('click', () => {
      state.tag = state.tag === tag ? '' : tag;
      writeUrlState();
      renderFilters();
      render();
    });
    els.filters.append(btn);
  }
}

function renderStats(generatedAt) {
  const count = state.projects.length;
  const latest = state.projects
    .map((p) => p.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const parts = [`${count} 個工具`];
  if (latest) parts.push(`最近更新 ${relative(latest)}`);
  els.stats.textContent = parts.join(' · ');
  els.generatedAt.textContent = generatedAt ? `資料更新於 ${formatDate(generatedAt)}` : '';
}

function visibleProjects() {
  const q = state.q.toLowerCase();
  const list = state.projects.filter((p) => {
    if (state.tag && !(p.tags || []).includes(state.tag)) return false;
    if (!q) return true;
    return [p.title, p.description, p.id, ...(p.tags || [])]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });

  const sorters = {
    updated: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    created: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
    name: (a, b) => a.title.localeCompare(b.title, 'zh-Hant'),
  };
  return list.sort(sorters[state.sort] || sorters.updated);
}

function render() {
  const list = visibleProjects();
  els.grid.textContent = '';
  els.empty.hidden = list.length > 0;

  for (const p of list) {
    els.grid.append(card(p));
  }
}

function card(p) {
  const el = document.createElement('article');
  el.className = 'card';

  const head = document.createElement('div');
  head.className = 'card-head';

  const emoji = document.createElement('span');
  emoji.className = 'card-emoji';
  emoji.setAttribute('aria-hidden', 'true');
  emoji.textContent = p.emoji || '🧰';

  const title = document.createElement('h2');
  title.className = 'card-title';
  const link = document.createElement('a');
  link.href = p.url;
  link.textContent = p.title;
  title.append(link);

  if (p.version) {
    const version = document.createElement('span');
    version.className = 'version';
    version.dataset.kind = p.versionSource === 'date' ? 'date' : 'semver';
    version.textContent = p.versionSource === 'date' ? p.version : `v${p.version}`;
    version.title = p.versionSource === 'date'
      ? '未標註版本，顯示最後更新日期'
      : `版本來源：${versionLabel(p.versionSource)}`;
    head.append(emoji, title, version);
  } else {
    head.append(emoji, title);
  }

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = p.description || '';

  el.append(head, desc);

  if (p.tags?.length) {
    const tags = document.createElement('ul');
    tags.className = 'card-tags';
    for (const tag of p.tags) {
      const li = document.createElement('li');
      li.textContent = `#${tag}`;
      tags.append(li);
    }
    el.append(tags);
  }

  const foot = document.createElement('div');
  foot.className = 'card-foot';

  if (p.updatedAt) {
    const updated = document.createElement('span');
    updated.className = 'meta';
    updated.textContent = `更新於 ${relative(p.updatedAt)}`;
    updated.title = formatDate(p.updatedAt);
    foot.append(updated);
  }

  if (p.language) {
    const lang = document.createElement('span');
    lang.className = 'meta';
    const dot = document.createElement('span');
    dot.className = 'lang-dot';
    lang.append(dot, document.createTextNode(p.language));
    foot.append(lang);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const open = document.createElement('a');
  open.className = 'btn btn-primary';
  open.href = p.url;
  open.textContent = '開啟工具';
  actions.append(open);

  if (p.repoUrl) {
    const repo = document.createElement('a');
    repo.className = 'btn';
    repo.href = p.repoUrl;
    repo.target = '_blank';
    repo.rel = 'noopener';
    repo.textContent = '原始碼';
    actions.append(repo);
  }

  foot.append(actions);
  el.append(foot);
  return el;
}

function relative(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const diffMs = then.getTime() - Date.now();
  const units = [
    ['year', 365 * 24 * 3600e3],
    ['month', 30 * 24 * 3600e3],
    ['day', 24 * 3600e3],
    ['hour', 3600e3],
    ['minute', 60e3],
  ];
  const rtf = new Intl.RelativeTimeFormat('zh-Hant-HK', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return '剛剛';
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('zh-Hant-HK', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function versionLabel(source) {
  return {
    manual: '手動指定',
    'version.json': 'version.json',
    'package.json': 'package.json',
    tag: 'git tag',
    date: '最後更新日期',
  }[source] || source;
}
