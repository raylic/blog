import type { MiddlewareHandler } from 'astro';

/**
 * 只在 dev（npm run admin / npm run dev）生效的两件事：
 *
 *   1. 往 Keystatic 后台页面注入一个「发布」浮动按钮
 *   2. 提供 POST /api/publish —— 执行 git add -A → commit → push，
 *      之后的构建交给 Cloudflare Pages 的 Git 集成（项目 blog-git）
 *
 * 生产构建里 import.meta.env.DEV 为 false，整个逻辑短路：不注入、不开接口。
 * 后台本来就不上线（见 astro.config.mjs 的 isDev），所以这块不参与静态产物。
 */
const isDev = import.meta.env.DEV;

const DEFAULT_MSG = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `写作更新 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const WIDGET = `
<style>
  #pf-ship { position: fixed; right: 24px; bottom: 24px; z-index: 2147483000;
    font: 13px/1.5 -apple-system, "Noto Sans SC", system-ui, sans-serif; }
  #pf-ship * { box-sizing: border-box; }
  #pf-ship-btn { display: flex; align-items: center; gap: 6px; padding: 10px 16px;
    background: #414951; color: #e8e6e1; border: 1px solid #6b737a; border-radius: 4px;
    cursor: pointer; letter-spacing: .5px; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
  #pf-ship-btn:hover { background: #4a525a; }
  #pf-ship-btn[data-busy="1"] { opacity: .6; cursor: progress; }
  #pf-panel { position: absolute; right: 0; bottom: calc(100% + 10px); width: 300px;
    background: #2b3138; color: #e8e6e1; border: 1px solid #4a525a; border-radius: 4px;
    padding: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
  #pf-panel[hidden] { display: none; }
  #pf-panel .pf-title { font-weight: 500; margin-bottom: 4px; }
  #pf-panel .pf-hint { color: #9aa0a6; font-size: 12px; margin-bottom: 10px; line-height: 1.5; }
  #pf-panel .pf-input { width: 100%; padding: 7px 8px; background: #363d45; color: #e8e6e1;
    border: 1px solid #6b737a; border-radius: 3px; font: inherit; outline: none; }
  #pf-panel .pf-input:focus { border-color: #b6bcc2; }
  #pf-panel .pf-actions { display: flex; gap: 8px; margin-top: 10px; }
  #pf-panel .pf-actions button { flex: 1; padding: 7px 10px; border-radius: 3px; cursor: pointer;
    font: inherit; border: 1px solid #6b737a; background: #363d45; color: #e8e6e1; }
  #pf-panel .pf-go { background: #5a6470; border-color: #808a94; }
  #pf-panel .pf-go:hover { background: #6b7783; }
  #pf-panel button:disabled { opacity: .5; cursor: not-allowed; }
  #pf-status { margin-top: 10px; font-size: 12px; line-height: 1.5; white-space: pre-wrap;
    word-break: break-all; }
  #pf-status[data-state="ok"] { color: #8fd18f; }
  #pf-status[data-state="err"] { color: #e88b8b; }
  #pf-status[data-state="busy"] { color: #9aa0a6; }
</style>
<div id="pf-ship">
  <div id="pf-panel" hidden>
    <div class="pf-title">发布到线上</div>
    <div class="pf-hint">git add -A → commit → push<br>云端构建由 Cloudflare Pages 接手</div>
    <input id="pf-msg" class="pf-input" type="text" spellcheck="false" />
    <div class="pf-actions">
      <button id="pf-go" class="pf-go" type="button">推送</button>
      <button id="pf-cancel" type="button">取消</button>
    </div>
    <div id="pf-status"></div>
  </div>
  <button id="pf-ship-btn" type="button">↑ 发布</button>
</div>
<script>
(function () {
  if (window.__pfShipReady) return;
  window.__pfShipReady = true;

  var wrap = document.getElementById('pf-ship');
  var btn = document.getElementById('pf-ship-btn');
  var panel = document.getElementById('pf-panel');
  var msg = document.getElementById('pf-msg');
  var go = document.getElementById('pf-go');
  var cancel = document.getElementById('pf-cancel');
  var status = document.getElementById('pf-status');

  function pad(n) { return String(n).padStart(2, '0'); }
  function defaultMsg() {
    var d = new Date();
    return '写作更新 ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function say(text, state) {
    status.textContent = text;
    status.setAttribute('data-state', state || '');
  }
  function busy(on) {
    go.disabled = on;
    cancel.disabled = on;
    btn.setAttribute('data-busy', on ? '1' : '0');
  }

  btn.addEventListener('click', function () {
    var open = panel.hidden;
    panel.hidden = !open;
    if (open) {
      if (!msg.value) msg.value = defaultMsg();
      msg.focus();
      msg.select();
    }
  });

  cancel.addEventListener('click', function () {
    panel.hidden = true;
    say('', '');
  });

  msg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); go.click(); }
  });

  go.addEventListener('click', function () {
    busy(true);
    say('正在提交并推送…', 'busy');
    fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: msg.value })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        var b = res.body || {};
        if (res.ok && b.ok) {
          if (b.skipped) {
            say('没有需要提交的改动', 'ok');
          } else {
            say('已推送 ' + (b.commit || '') + '\\nCloudflare 正在构建，1~2 分钟后生效', 'ok');
          }
        } else {
          say('失败：\\n' + (b.error || '未知错误'), 'err');
        }
      })
      .catch(function (e) {
        say('请求失败：' + e.message, 'err');
      })
      .finally(function () { busy(false); });
  });
})();
</script>
`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function handlePublish(request: Request): Promise<Response> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const path = await import('node:path');

  const run = promisify(execFile);
  // dev server 的工作目录是 blog/，仓库根在上一层
  const repoRoot = path.resolve(process.cwd(), '..');

  const git = async (args: string[]) => {
    const { stdout, stderr } = await run('git', args, {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  };

  let message = '';
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body?.message === 'string') message = body.message.trim();
  } catch {
    // 没带 body 就用默认信息
  }
  if (!message) message = DEFAULT_MSG();

  try {
    await git(['add', '-A']);

    const status = await git(['status', '--porcelain']);
    if (!status.stdout.trim()) {
      return json({ ok: true, skipped: '没有改动' });
    }

    await git(['commit', '-m', message]);
    const head = await git(['rev-parse', '--short', 'HEAD']);
    const push = await git(['push']);

    return json({
      ok: true,
      commit: head.stdout.trim(),
      detail: (push.stdout + push.stderr).trim(),
    });
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    return json({ ok: false, error: (e.stderr || e.message || String(err)).trim() }, 500);
  }
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  if (!isDev) return next();

  // POST /api/publish —— 只在本机 dev 下存在的发布接口
  if (context.url.pathname === '/api/publish' && context.request.method === 'POST') {
    return handlePublish(context.request);
  }

  const response = await next();

  // 只处理 Keystatic 后台的 HTML 页面，顺手把按钮塞进去
  if (!context.url.pathname.startsWith('/keystatic')) return response;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');

  const injected = html.includes('</body>')
    ? html.replace('</body>', `${WIDGET}</body>`)
    : html + WIDGET;

  return new Response(injected, { status: response.status, headers });
};
