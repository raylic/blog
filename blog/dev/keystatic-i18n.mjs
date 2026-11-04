// dev/keystatic-i18n.mjs
//
// Keystatic 后台（/keystatic）中文化 —— dev-only 注入
//
// 背景（2026-11-04 调研）：
//   @keystatic/core 0.6.9 没有 i18n/locale 接口（config.ui 只有 brand），
//   而本项目 keystatic.config.ts 里的字段标签**已经全是中文**，
//   剩下的英文全部来自 keystatic 自带的界面外壳（Save / Unsaved / Insert block / Quote …）。
//   所以这里走「DOM 覆盖翻译」：往 /keystatic 的 HTML 里塞一段自包含脚本，
//   用词典 + MutationObserver 把 DOM 文本、placeholder/title/aria-label/alt 换成中文。
//
// 注入点为什么是中间件而不是 transformIndexHtml：
//   Astro（实测 dist 里搜不到 transformIndexHtml）不走 Vite 那套 HTML 管道，
//   常规注入路子在 Astro dev 里根本不触发。只能用 configureServer 中间件
//   抢在 Astro 之前把 /keystatic 的响应缓冲下来，在 </body> 前追加脚本。
//   ⚠️ 必须缓冲：Astro 没显式 writeHead，Content-Length 由 Node 在 end() 里自动算，
//      所以我们在 end() 里改长度是安全的；直写会让头先落地，追加的尾巴就被截掉。
//
// 只在 dev 生效（apply:"serve"），生产构建完全不带这段代码
// （keystatic 本身也只在 dev 挂载，见 astro.config.mjs 的 isDev）。
//
// 词典是「命中才翻」，keystatic 升级后若冒出新的英文串，往 DICT 里补一条即可。
// 扫词典用的脚本：见本文件末尾注释。

// ── 注入的客户端脚本（自包含，无依赖，不用模板字符串语法）────────────────
const CLIENT_SOURCE = String.raw`
(function () {
  if (window.__ksI18n) return;
  window.__ksI18n = true;

  var DICT = {
    // 顶栏 / 保存条
    "Save": "保存",
    "Saving changes": "正在保存",
    "Unsaved": "未保存",
    "Reset changes": "放弃改动",
    "Reset": "重置",
    "Undo": "撤销",
    "Preview": "预览",
    "Done": "完成",
    "Cancel": "取消",
    "Create": "新建",
    "Creating entry": "正在新建",
    "Create the first entry": "创建第一篇",
    "Create entry": "新建",
    "Options": "选项",
    "Open app navigation": "打开侧栏",
    "User menu": "用户菜单",
    "Content": "内容",
    "Dashboard": "概览",
    "Keystatic": "raylic.work 内容后台",

    // 列表 / 空态 / 状态
    "Add": "添加",
    "Add item": "添加一项",
    "Add the first item to see it here.": "先添加一项，内容会显示在这里。",
    "to see it here.": "之后会显示在这里。",
    "Empty list": "暂无内容",
    "Empty collection": "还没有内容",
    "There aren't any entries yet.": "还没有任何内容。",
    "No results": "没有匹配项",
    "Loading Entries": "正在加载列表",
    "Loading Item": "正在加载",
    "Entry created": "已创建",
    "Entry pasted": "已粘贴",
    "Entry not found.": "没找到这篇内容。",
    "Copy entry": "复制这篇",
    "Paste entry": "粘贴这篇",
    "Delete entry": "删除这篇",
    "Save and duplicate": "保存并复制",
    "Save and duplicate entry": "保存并复制这篇",
    "Unable to load collection": "无法载入该集合",
    "Contains invalid fields. Please edit.": "有字段没填完整，请检查。",
    "Are you sure? This action cannot be undone.": "确定吗？此操作无法撤销。",
    "Yes, delete": "确认删除",
    "Delete": "删除",
    "Remove": "移除",
    "Edit": "编辑",
    "Edit item": "编辑",
    "Not found": "不存在",
    "This page could not be found.": "页面不存在。",
    "Keystatic doesn't have the required config.": "Keystatic 缺少必要配置。",
    "Git repo not initialised": "git 仓库未初始化",
    "Github repo": "GitHub 仓库",
    "Language": "语言",
    "Layouts": "版式",
    "Status": "状态",
    "Account": "账户",
    "Log out": "退出登录",

    // MDX 正文编辑器
    "Blocks": "块",
    "Lists": "列表",
    "Text block": "段落",
    "Text": "正文",
    "Heading": "标题",
    "Quote": "引用",
    "Code Block": "代码块",
    "Code block": "代码块",
    "Code block language": "代码语言",
    "Bullet List": "无序列表",
    "Bullet List (- )": "无序列表（- ）",
    "Numbered List": "有序列表",
    "Numbered List (1.)": "有序列表（1.）",
    "bullet list": "无序列表",
    "ordered list": "有序列表",
    "Table": "表格",
    "Header row": "表头行",
    "Select Table": "选择表格",
    "Select Row": "选择行",
    "Select Column": "选择列",
    "Cell options": "单元格选项",
    "Divider": "分割线",
    "Insert": "插入",
    "Insert block": "插入块",
    "Insert menu": "插入菜单",
    "Link": "链接",
    "Unlink": "取消链接",
    "Text formatting": "文字样式",
    "Text Alignment": "对齐方式",
    "Formatting options": "样式选项",
    "Image": "图片",
    "Image Library": "图片库",
    "Image library": "图片库",
    "Choose file": "选择文件",
    "Image URL": "图片地址",
    "Image URL is required.": "需要填图片地址。",
    "Image details": "图片详情",
    "Edit Image Options": "图片选项",
    "Remove Image": "移除图片",
    "Alt text": "替代文字",
    "Constrain proportions": "锁定比例",
    "Width": "宽",
    "Height": "高",
    "File name": "文件名",
    "Filename": "文件名",
    "Optional title": "标题（可留空）",
    "Cloud image": "云图片",
    "Ref": "引用",
    "Regenerate": "重新生成",
    "Download": "下载",
    "Please provide a valid URL.": "请填写合法的链接。",
    "Copy an image URL from the": "从这里复制一个图片地址，",
    "Upload an image, or copy a URL from the": "上传图片，或从下面这里复制地址：",

    // 快捷键提示
    "Backspace": "退格",
    "Escape": "Esc",
    "Enter": "回车",

    // 日期控件
    "Today": "今天",
    "Clear": "清空",
    "Show calendar": "打开日历",
    January: "1 月", February: "2 月", March: "3 月", April: "4 月",
    May: "5 月", June: "6 月", July: "7 月", August: "8 月",
    September: "9 月", October: "10 月", November: "11 月", December: "12 月",
    Monday: "星期一", Tuesday: "星期二", Wednesday: "星期三",
    Thursday: "星期四", Friday: "星期五", Saturday: "星期六", Sunday: "星期日",
    Mon: "一", Tue: "二", Wed: "三", Thu: "四", Fri: "五", Sat: "六", Sun: "日",
    Mo: "一", Tu: "二", We: "三", Th: "四", Fr: "五", Sa: "六", Su: "日"
  };

  var ATTRS = ["placeholder", "title", "aria-label", "alt"];

  function pad(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

  function norm(s) { return s.replace(/\s+/g, " ").trim(); }

  function lookup(raw) {
    var s = norm(raw);
    if (!s) return null;
    if (Object.prototype.hasOwnProperty.call(DICT, s)) return DICT[s];

    var m;
    // "October 2026" → "2026 年 10 月"（日历表头）
    m = s.match(/^([A-Z][a-z]+) (\d{4})$/);
    if (m && DICT[m[1]]) return m[2] + " 年 " + DICT[m[1]];
    // 美式日期 10/12/2026 → 2026-10-12
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + "-" + pad(m[1]) + "-" + pad(m[2]);
    // "Hello, xxx"
    m = s.match(/^Hello,?\s+(.*)$/);
    if (m) return "你好，" + m[1];
    // "Restored draft from <时间戳>"
    m = s.match(/^Restored draft from\s+(.*)$/);
    if (m) return "已恢复草稿（来自 " + m[1] + "）";
    // 句首 "The " / "the " 这类拼接串不猜，保持原样
    return null;
  }

  var queue = null;
  function flush() {
    queue = null;
    var walker = document.createTreeWalker(document.body, 1 | 4);
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) {
        var tag = n.parentNode && n.parentNode.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "CODE" || tag === "PRE") continue;
        var t = lookup(n.nodeValue);
        if (t) n.nodeValue = t;
      } else if (n.nodeType === 1) {
        for (var i = 0; i < ATTRS.length; i++) {
          var v = n.getAttribute(ATTRS[i]);
          if (v) {
            var tv = lookup(v);
            if (tv) n.setAttribute(ATTRS[i], tv);
          }
        }
      }
    }
    var title = lookup(document.title || "");
    if (title) document.title = title;
  }
  function schedule() { if (!queue) queue = requestAnimationFrame(flush); }

  var observer = new MutationObserver(schedule);
  function start() {
    if (!document.body) { setTimeout(start, 20); return; }
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
    schedule();
    // 兜底：Radix 弹层/提示是异步挂到 body 外的 portal，
    // 极端情况下漏掉一次 mutation，就靠这轮定时扫补上（0.7s 足够无感）。
    setInterval(schedule, 700);
  }
  start();
})();
`;

// 只匹配后台路由本身；站点页面不经过这个中间件
const ADMIN_PATH = /^\/keystatic(\/|\?|$)/;

function inject(html) {
  const tag = `<script>${CLIENT_SOURCE}</script>`;
  const at = html.lastIndexOf('</body>');
  if (at === -1) return html + tag;
  return html.slice(0, at) + tag + html.slice(at);
}

export function keystaticI18n() {
  return {
    name: 'keystatic-i18n',
    apply: 'serve',
    // 注册位置是这里最反直觉的一点（实测：直接 server.middlewares.use 注入 0 命中）：
    //   Astro 自己的 dev handler 是在 configureServer **返回的 post 函数**里
    //   `middlewares.stack.unshift(...)` 抢到的栈顶（见 astro/dist/vite-plugin-astro-server/plugin.js:135），
    //   所以无论我们把插件排在用户插件前后、加 order:"pre" 都抢不过它 —— handler 先写完响应，
    //   我们的中间件根本看不到请求。
    //   正解：自己也在 post 阶段（configureServer 返回的函数）把中间件 unshift 到栈顶，
    //   而且 Astro 的 post 先跑（它在插件数组里排在用户插件之前）→ 我们排在它前面。
    //   这样我们抢到 res 对象，在 Astro 写之前把 write/end 接走、缓冲、注入。
    configureServer(server) {
      // configureServer 返回的函数 = vite 的 post 阶段，此时 Astro 的 dev handler 已经
      // 挂在 middlewares 栈上；unshift 到栈顶才能抢在它前面拿到 res。
      return () => {
        const handle = (req, res, next) => {
          const url = req.url || '';
          if (url.split('?')[0] !== '/keystatic' && !url.startsWith('/keystatic/')) return next();

          const chunks = [];
          const origWrite = res.write.bind(res);
          const origEnd = res.end.bind(res);
          const origWriteHead = res.writeHead.bind(res);
          let head = null; // 把 writeHead 也扣下来，长度留到最后算
          const headHeaders = {};

          const push = (c, enc) => {
            if (c == null) return;
            chunks.push(typeof c === 'string' ? Buffer.from(c, typeof enc === 'string' ? enc : 'utf8') : c);
          };
          const cbOf = (a, b) => (typeof a === 'function' ? a : typeof b === 'function' ? b : null);

          // 关键：Astro 会先 writeHead（带着按**原文**算好的 Content-Length），
          // 那一调用 headersSent 就变 true，之后再改长度已经来不及（实测：注入被
          // 这行 if (!res.headersSent) 挡掉，命中数一直是 0）。
          // 所以 writeHead 也不能放过去，扣到 end() 里连同最终长度一起发。
          res.writeHead = (...args) => {
            // 只记账，不发。写 Head 里带的头（content-type 等）要单独留一份：
            // 扣下 writeHead 之后 res.getHeader('content-type') 会变成空（实测），
            // 因为 Astro 是把 content-type 连着头一起 writeHead 进来的。
            head = args;
            const obj = args.find((a) => a && typeof a === 'object');
            if (obj) Object.assign(headHeaders, obj);
            return res;
          };
          res.write = (c, enc, cb) => {
            push(c, enc);
            const fn = cbOf(enc, cb);
            if (fn) fn();
            return true;
          };
          res.end = (c, enc, cb) => {
            push(c, enc);
            const fn = cbOf(enc, cb);

            let body = Buffer.concat(chunks);
            // 头合并顺序照 Node 的语义：writeHead 传的会被后到的 setHeader 覆盖
            const headers = { ...headHeaders, ...res.getHeaders() };
            const type = String(headers['content-type'] || headers['Content-Type'] || '');
            const injectable = /text\/html/.test(type) && body.length > 0;
            if (injectable) body = Buffer.from(inject(body.toString('utf8')), 'utf8');

            const status = head && typeof head[0] === 'number' ? head[0] : res.statusCode;
            const reason = head && typeof head[1] === 'string' ? head[1] : undefined;
            const finalHeaders = { ...headers, 'content-length': String(body.length) };
            // 乱码根因（实测）：Astro 发的是 `content-type: text/html`，**不带 charset**
            // （站点首页也一样，只是首页 HTML 里有 <meta charset>，后台没有）。
            // 于是浏览器按系统默认编码（中文环境 = GBK）解，我们注入的 UTF-8 中文全是乱码。
            // 修法在响应头上，不在 HTML 里：给后台响应补 charset。
            if (injectable && !/charset/i.test(type)) {
              finalHeaders['content-type'] = type.replace(/;.*$/, '') + '; charset=utf-8';
            }
            if (!res.headersSent) {
              if (reason) origWriteHead(status, reason, finalHeaders);
              else origWriteHead(status, finalHeaders);
            }
            if (fn) fn();
            return origEnd(body);
          };

          next();
        };
        server.middlewares.stack.unshift({ route: '', handle });
      };
    },
  };
}

/* 词典是怎么扫出来的（keystatic 升级后想补词条时照做）：
   python3 脚本遍历 @keystatic/core/dist/*.js，抽出双引号里的英文字面量，
   过滤掉内部 camelCase key（branchName 这类）和 SVG path，剩下的就是界面文案候选。
   本次扫出 155 条候选，其中 GitHub / Keystatic Cloud 那一大票在 local 模式下不会出现，未收进词典。 */
