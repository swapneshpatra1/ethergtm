import { readdir, readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'blog', 'posts');
const BLOG_DIR = join(ROOT, 'blog');
const SITE_URL = 'https://ethergtm.co';
const SITE_NAME = 'etherGTM';
const GA_ID = 'G-ZEJ6CC3HM2';

const CATEGORIES = [
  { name: 'Outbound', slug: 'outbound' },
  { name: 'GTM', slug: 'gtm' },
  { name: 'AI Automation', slug: 'ai-automation' },
  { name: 'RevOps', slug: 'revops' },
];

function slugify(str) {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Slugifies h2/h3 text, injects ids, and collects a table of contents.
function injectHeadingIdsAndExtractToc(html) {
  const toc = [];
  const used = new Map();
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = slugify(text) || 'section';
    if (used.has(id)) {
      const n = used.get(id) + 1;
      used.set(id, n);
      id = `${id}-${n}`;
    } else {
      used.set(id, 0);
    }
    toc.push({ level: Number(level), text, id });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}

const HEAD_ASSETS = `
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            navy: { 950: '#040B18', 900: '#080F20', 800: '#0D1830', 700: '#112244' },
            brand: '#1C7EFF',
            cyan:  '#00C4FF',
          },
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

    .grad        { background: linear-gradient(135deg, #1C7EFF 0%, #00C4FF 100%); }
    .grad-text   { background: linear-gradient(135deg, #1C7EFF 0%, #00C4FF 100%);
                   -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                   background-clip: text; }

    .grain::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
      opacity: 0.035;
    }

    .nav-link { position: relative; transition: color 0.2s; }
    .nav-link::after {
      content: ''; position: absolute; bottom: -3px; left: 0; width: 0; height: 1.5px;
      background: linear-gradient(90deg, #1C7EFF, #00C4FF); transition: width 0.25s ease;
    }
    .nav-link:hover { color: #1C7EFF; }
    .nav-link:hover::after { width: 100%; }

    .btn-pri {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      background: linear-gradient(135deg, #1C7EFF 0%, #00C4FF 100%);
      color: #fff; font-weight: 600; border-radius: 10px; cursor: pointer;
      transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease;
      text-decoration: none;
    }
    .btn-pri:hover  { transform: translateY(-2px); box-shadow: 0 12px 36px -4px rgba(28,126,255,.45); }
    .btn-pri:active { transform: translateY(0); box-shadow: none; }
    .btn-pri:focus-visible { outline: 2px solid #1C7EFF; outline-offset: 3px; }

    .post-card { transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease; }
    .post-card:hover { transform: translateY(-5px); box-shadow: 0 24px 64px -12px rgba(28,126,255,.18); }
    .post-card:focus-visible { outline: 2px solid #1C7EFF; outline-offset: 3px; }

    .cat-pill { transition: background 0.2s, border-color 0.2s, color 0.2s; text-decoration: none; }
    .cat-pill:hover { border-color: #1C7EFF; color: #1C7EFF; }
    .cat-pill:focus-visible { outline: 2px solid #1C7EFF; outline-offset: 2px; }
    .cat-pill.active { background: linear-gradient(135deg, #1C7EFF 0%, #00C4FF 100%); color: #fff; border-color: transparent; }

    .tag-pill { transition: background 0.2s, color 0.2s; text-decoration: none; }
    .tag-pill:hover { background: #E2EEFF; color: #1C7EFF; }
    .tag-pill:focus-visible { outline: 2px solid #1C7EFF; outline-offset: 2px; }

    .toc a { transition: color 0.2s; }
    .toc a:hover { color: #1C7EFF; }

    .orb { border-radius: 50%; filter: blur(90px); position: absolute; pointer-events: none; }

    .post-body { color: #374151; line-height: 1.85; font-size: 1.0625rem; }
    .post-body h2 { font-size: 1.625rem; font-weight: 800; color: #0D1830; letter-spacing: -0.02em; margin: 2.5rem 0 1rem; }
    .post-body h3 { font-size: 1.25rem; font-weight: 700; color: #0D1830; letter-spacing: -0.01em; margin: 2rem 0 0.75rem; }
    .post-body p  { margin: 0 0 1.25rem; }
    .post-body ul, .post-body ol { margin: 0 0 1.25rem; padding-left: 1.5rem; }
    .post-body li { margin-bottom: 0.5rem; }
    .post-body ul li { list-style: disc; }
    .post-body ol li { list-style: decimal; }
    .post-body a { color: #1C7EFF; font-weight: 600; text-decoration: underline; text-decoration-color: rgba(28,126,255,.3); }
    .post-body a:hover { text-decoration-color: #1C7EFF; }
    .post-body strong { color: #0D1830; font-weight: 700; }
    .post-body blockquote { margin: 1.5rem 0; padding: 1rem 1.5rem; border-left: 3px solid #1C7EFF; background: #F4F8FF; border-radius: 0 12px 12px 0; color: #112244; font-style: italic; }
    .post-body code { background: #EFF5FF; color: #112244; padding: 0.15rem 0.4rem; border-radius: 6px; font-size: 0.9em; }
    .post-body img { border-radius: 16px; margin: 1.5rem 0; }
    .post-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9375rem; }
    .post-body th, .post-body td { padding: 0.75rem 1rem; border: 1px solid #DDE8F8; text-align: left; }
    .post-body th { background: #F4F8FF; color: #0D1830; font-weight: 700; }
    .post-body tr:nth-child(even) td { background: #FAFBFF; }
  </style>
`;

function renderGtag() {
  return `
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  </script>`;
}

function renderHeader() {
  return `
  <header class="fixed top-0 inset-x-0 z-50 backdrop-blur-md"
          style="background:rgba(8,15,32,0.95);border-bottom:1px solid rgba(255,255,255,0.08);">
    <div class="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-20">
      <a href="/" aria-label="etherGTM home" class="flex items-center flex-shrink-0">
        <img src="/ethergtm-logo.png" alt="etherGTM" style="width:200px;height:auto;border-radius:10px;" />
      </a>
      <nav class="hidden md:flex items-center gap-7">
        <a href="/index.html#services"  class="nav-link text-sm font-medium text-gray-300">Services</a>
        <a href="/index.html#process"   class="nav-link text-sm font-medium text-gray-300">How It Works</a>
        <a href="/index.html#why-us"    class="nav-link text-sm font-medium text-gray-300">Why etherGTM</a>
        <a href="/blog/" class="nav-link text-sm font-medium text-gray-300">Blog</a>
        <a href="https://swapnesh2109.typeform.com/to/wWBVVCWz" target="_blank" rel="noopener" class="nav-link text-sm font-medium text-gray-300">Contact</a>
      </nav>
      <a href="https://swapnesh2109.typeform.com/to/wWBVVCWz" target="_blank" rel="noopener" class="btn-pri text-sm px-5 py-2.5">Book a Call</a>
    </div>
  </header>`;
}

function renderFooter() {
  return `
  <footer style="background:#040B18;border-top:1px solid rgba(255,255,255,.06);">
    <div class="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      <div class="flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="/" class="flex items-center">
          <img src="/ethergtm-logo.png" alt="etherGTM" style="width:180px;height:auto;border-radius:8px;" />
        </a>
        <div class="flex items-center gap-6 text-sm" style="color:rgba(255,255,255,.4);">
          <a href="/index.html#services" class="hover:text-white transition-colors">Services</a>
          <a href="/blog/" class="hover:text-white transition-colors">Blog</a>
          <a href="/index.html#why-us" class="hover:text-white transition-colors">Why Us</a>
          <a href="https://swapnesh2109.typeform.com/to/wWBVVCWz" target="_blank" rel="noopener" class="hover:text-white transition-colors">Contact</a>
        </div>
        <p class="text-xs" style="color:rgba(255,255,255,.25);">&copy; ${new Date().getFullYear()} etherGTM. All rights reserved.</p>
      </div>
    </div>
  </footer>`;
}

function categoryInfo(categoryName) {
  return CATEGORIES.find(c => c.name === categoryName);
}

function categoryBadge(categoryName) {
  // Rendered as a <span>, not a link: every caller already nests this inside
  // the post card's own <a>, and a nested <a> is invalid HTML that breaks layout.
  return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest" style="background:#EBF3FF;color:#1C7EFF;border:1px solid #DDE8F8;">${escapeHtml(categoryName)}</span>`;
}

function categoryBreadcrumbLink(categoryName) {
  const cat = categoryInfo(categoryName);
  const href = cat ? `/blog/category/${cat.slug}/` : '/blog/';
  return `<a href="${href}" class="hover:text-white">${escapeHtml(categoryName)}</a>`;
}

function tagPill(tag) {
  return `<a href="/blog/tag/${slugify(tag)}/" class="tag-pill inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" style="background:#F4F8FF;color:#5B7390;">#${escapeHtml(tag)}</a>`;
}

function postCard(post) {
  return `
  <a href="/blog/${post.slug}/" class="post-card rounded-2xl overflow-hidden flex flex-col" style="background:#fff;border:1.5px solid #DDE8F8;text-decoration:none;">
    <div class="aspect-[16/9] overflow-hidden" style="background:#EEF5FF;">
      <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" class="w-full h-full object-cover" loading="lazy" />
    </div>
    <div class="p-6 flex flex-col flex-1">
      <div class="mb-3">${categoryBadge(post.category)}</div>
      <h3 class="text-lg font-bold text-gray-900 mb-2" style="letter-spacing:-0.02em;line-height:1.35;">${escapeHtml(post.title)}</h3>
      <p class="text-sm text-gray-400 mb-4 flex-1" style="line-height:1.7;">${escapeHtml(post.description)}</p>
      <div class="flex items-center gap-2 text-xs text-gray-400 mt-auto">
        <span>${escapeHtml(post.author)}</span>
        <span>&middot;</span>
        <span>${formatDate(post.date)}</span>
      </div>
    </div>
  </a>`;
}

function categoryPillsRow(activeSlug) {
  const all = `<a href="/blog/" class="cat-pill px-4 py-2 rounded-full text-sm font-semibold ${!activeSlug ? 'active' : ''}" style="border:1.5px solid #DDE8F8;color:#374151;">All Posts</a>`;
  const pills = CATEGORIES.map(c => `<a href="/blog/category/${c.slug}/" class="cat-pill px-4 py-2 rounded-full text-sm font-semibold ${activeSlug === c.slug ? 'active' : ''}" style="border:1.5px solid #DDE8F8;color:#374151;">${c.name}</a>`).join('\n');
  return `<div class="flex flex-wrap gap-3">${all}${pills}</div>`;
}

function page({ title, description, canonical, schema, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" href="/ethergtm-logo.png">
  <link rel="alternate" type="application/rss+xml" title="${SITE_NAME} Blog" href="${SITE_URL}/rss.xml" />
${renderGtag()}
${HEAD_ASSETS}
${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ''}
</head>
<body class="bg-white text-gray-900">
${renderHeader()}
${bodyHtml}
${renderFooter()}
</body>
</html>`;
}

function renderBlogIndexBody(posts) {
  const cards = posts.map(postCard).join('\n');
  return `
  <section class="relative overflow-hidden grain" style="background:#080F20;padding:160px 0 80px;">
    <div class="orb" style="width:420px;height:420px;top:-100px;left:-80px;background:#1C7EFF;opacity:.12;"></div>
    <div class="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 text-center">
      <span class="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6" style="background:rgba(28,126,255,.12);border:1px solid rgba(28,126,255,.35);color:#60AAFF;">The etherGTM Blog</span>
      <h1 class="text-4xl lg:text-6xl font-extrabold text-white" style="letter-spacing:-0.03em;line-height:1.1;">
        Outbound, GTM &amp; AI<br /><span class="grad-text">playbooks that ship pipeline</span>
      </h1>
      <p class="mt-6 text-lg text-gray-300 max-w-2xl mx-auto" style="line-height:1.75;">
        Notes from the trenches of cold email, LinkedIn outbound, AI automation, and RevOps &mdash; written by the team running campaigns for real B2B pipelines.
      </p>
    </div>
  </section>
  <section class="py-16 lg:py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-10">
      <div class="mb-12">${categoryPillsRow(null)}</div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        ${cards}
      </div>
    </div>
  </section>`;
}

function renderPostBody(post, toc, relatedPosts) {
  const tocHtml = toc.length >= 2 ? `
        <div class="toc rounded-2xl p-6 mb-10" style="background:#F4F8FF;border:1.5px solid #DDE8F8;">
          <p class="text-xs font-semibold uppercase tracking-widest mb-4" style="color:#1C7EFF;">On this page</p>
          <ul class="space-y-2">
            ${toc.map(t => `<li style="margin-left:${(t.level - 2) * 16}px;"><a href="#${t.id}" class="text-sm text-gray-500">${escapeHtml(t.text)}</a></li>`).join('\n')}
          </ul>
        </div>` : '';

  const tagsHtml = post.tags.length ? `<div class="flex flex-wrap gap-2 mt-6">${post.tags.map(tagPill).join('')}</div>` : '';

  const relatedHtml = relatedPosts.length ? `
    <section class="py-20 lg:py-24" style="background:#F4F8FF;">
      <div class="max-w-7xl mx-auto px-6 lg:px-10">
        <h2 class="text-3xl font-bold text-gray-900 mb-10" style="letter-spacing:-0.02em;">Related Articles</h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          ${relatedPosts.map(postCard).join('\n')}
        </div>
      </div>
    </section>` : '';

  return `
  <article>
    <section class="relative overflow-hidden grain" style="background:#080F20;padding:160px 0 64px;">
      <div class="orb" style="width:420px;height:420px;top:-100px;right:-80px;background:#00C4FF;opacity:.1;"></div>
      <div class="relative z-10 max-w-3xl mx-auto px-6 lg:px-10">
        <nav class="text-sm mb-6" style="color:rgba(255,255,255,.4);">
          <a href="/" class="hover:text-white">Home</a> /
          <a href="/blog/" class="hover:text-white">Blog</a> /
          ${categoryBreadcrumbLink(post.category)}
        </nav>
        <h1 class="text-3xl lg:text-5xl font-extrabold text-white mb-6" style="letter-spacing:-0.03em;line-height:1.15;">${escapeHtml(post.title)}</h1>
        <p class="text-lg text-gray-300 mb-8" style="line-height:1.75;">${escapeHtml(post.description)}</p>
        <div class="flex items-center gap-3 text-sm" style="color:rgba(255,255,255,.5);">
          <a href="/blog/author/${slugify(post.author)}/" class="font-medium text-white hover:text-[#60AAFF]">${escapeHtml(post.author)}</a>
          <span>&middot;</span>
          <time datetime="${new Date(post.date).toISOString()}">${formatDate(post.date)}</time>
        </div>
      </div>
    </section>

    <section class="py-16 lg:py-20 bg-white">
      <div class="max-w-3xl mx-auto px-6 lg:px-10">
        <div class="aspect-[16/9] overflow-hidden rounded-2xl mb-10" style="background:#EEF5FF;">
          <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" class="w-full h-full object-cover" />
        </div>
        ${tocHtml}
        <div class="post-body">
          ${post.bodyHtml}
        </div>
        ${tagsHtml}
      </div>
    </section>

    ${relatedHtml}

    <section class="relative overflow-hidden grain py-20" style="background:#080F20;">
      <div class="orb" style="width:320px;height:320px;bottom:-80px;left:-60px;background:#1C7EFF;opacity:.1;"></div>
      <div class="relative z-10 max-w-2xl mx-auto px-6 lg:px-10 text-center">
        <h2 class="text-3xl lg:text-4xl font-bold text-white mb-4" style="letter-spacing:-0.03em;">Want results like this in your own pipeline?</h2>
        <p class="text-gray-300 mb-8" style="line-height:1.75;">Book a free strategy call and we'll map out a campaign plan for your ICP.</p>
        <a href="https://swapnesh2109.typeform.com/to/wWBVVCWz" target="_blank" rel="noopener" class="btn-pri text-base px-8 py-4">Book My Free Strategy Call</a>
      </div>
    </section>
  </article>`;
}

function renderCategoryBody(category, posts) {
  const cards = posts.length ? posts.map(postCard).join('\n') : `<p class="text-gray-400 col-span-full">No posts in this category yet.</p>`;
  return `
  <section class="relative overflow-hidden grain" style="background:#080F20;padding:160px 0 64px;">
    <div class="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 text-center">
      <span class="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6" style="background:rgba(28,126,255,.12);border:1px solid rgba(28,126,255,.35);color:#60AAFF;">Category</span>
      <h1 class="text-4xl lg:text-5xl font-extrabold text-white" style="letter-spacing:-0.03em;">${escapeHtml(category.name)}</h1>
    </div>
  </section>
  <section class="py-16 lg:py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-10">
      <div class="mb-12">${categoryPillsRow(category.slug)}</div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
    </div>
  </section>`;
}

function renderTagBody(tag, posts) {
  const cards = posts.map(postCard).join('\n');
  return `
  <section class="relative overflow-hidden grain" style="background:#080F20;padding:160px 0 64px;">
    <div class="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 text-center">
      <span class="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6" style="background:rgba(28,126,255,.12);border:1px solid rgba(28,126,255,.35);color:#60AAFF;">Tag</span>
      <h1 class="text-4xl lg:text-5xl font-extrabold text-white" style="letter-spacing:-0.03em;">#${escapeHtml(tag)}</h1>
    </div>
  </section>
  <section class="py-16 lg:py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-10">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
    </div>
  </section>`;
}

function renderAuthorBody(authorName, posts) {
  const cards = posts.map(postCard).join('\n');
  return `
  <section class="relative overflow-hidden grain" style="background:#080F20;padding:160px 0 64px;">
    <div class="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 text-center">
      <span class="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6" style="background:rgba(28,126,255,.12);border:1px solid rgba(28,126,255,.35);color:#60AAFF;">Author</span>
      <h1 class="text-4xl lg:text-5xl font-extrabold text-white mb-4" style="letter-spacing:-0.03em;">${escapeHtml(authorName)}</h1>
      <p class="text-gray-300 max-w-xl mx-auto" style="line-height:1.75;">Founder of etherGTM. Writes about cold email infrastructure, LinkedIn outbound, AI-driven prospecting, and the RevOps metrics that actually matter.</p>
    </div>
  </section>
  <section class="py-16 lg:py-20 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-10">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
    </div>
  </section>`;
}

async function build() {
  for (const dir of ['category', 'tag', 'author']) {
    const p = join(BLOG_DIR, dir);
    if (existsSync(p)) await rm(p, { recursive: true, force: true });
  }

  const files = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const raw = await readFile(join(POSTS_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    const slug = data.slug || slugify(file.replace(/\.md$/, ''));
    const rawHtml = marked.parse(content);
    const { html: bodyHtml, toc } = injectHeadingIdsAndExtractToc(rawHtml);
    posts.push({
      slug,
      title: data.title,
      description: data.description,
      author: data.author,
      date: data.date,
      image: data.image,
      category: data.category,
      tags: data.tags || [],
      bodyHtml,
      toc,
    });
  }

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Remove static output for posts that no longer exist in blog/posts/
  const blogEntries = await readdir(BLOG_DIR, { withFileTypes: true });
  for (const entry of blogEntries) {
    if (!entry.isDirectory()) continue;
    if (['posts', 'category', 'tag', 'author', 'images'].includes(entry.name)) continue;
    if (!posts.find(p => p.slug === entry.name)) {
      await rm(join(BLOG_DIR, entry.name), { recursive: true, force: true });
    }
  }

  await writeFile(join(BLOG_DIR, 'index.html'), page({
    title: 'Blog — etherGTM',
    description: 'Outbound, GTM, AI automation, and RevOps playbooks from the etherGTM team.',
    canonical: `${SITE_URL}/blog/`,
    bodyHtml: renderBlogIndexBody(posts),
  }));

  for (const post of posts) {
    const dir = join(BLOG_DIR, post.slug);
    await mkdir(dir, { recursive: true });

    const related = posts
      .filter(p => p.slug !== post.slug)
      .sort((a, b) => {
        const aSame = a.category === post.category ? 0 : 1;
        const bSame = b.category === post.category ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 3);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      image: post.image,
      datePublished: new Date(post.date).toISOString(),
      dateModified: new Date(post.date).toISOString(),
      articleSection: post.category,
      keywords: post.tags.join(', '),
      author: { '@type': 'Person', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/ethergtm-logo.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}/` },
    };

    await writeFile(join(dir, 'index.html'), page({
      title: `${post.title} — etherGTM Blog`,
      description: post.description,
      canonical: `${SITE_URL}/blog/${post.slug}/`,
      schema,
      bodyHtml: renderPostBody(post, post.toc, related),
    }));
  }

  for (const cat of CATEGORIES) {
    const catPosts = posts.filter(p => p.category === cat.name);
    const dir = join(BLOG_DIR, 'category', cat.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), page({
      title: `${cat.name} Articles — etherGTM Blog`,
      description: `Articles about ${cat.name} from the etherGTM team.`,
      canonical: `${SITE_URL}/blog/category/${cat.slug}/`,
      bodyHtml: renderCategoryBody(cat, catPosts),
    }));
  }

  const tagMap = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      const tslug = slugify(tag);
      if (!tagMap.has(tslug)) tagMap.set(tslug, { name: tag, posts: [] });
      tagMap.get(tslug).posts.push(post);
    }
  }
  for (const [tslug, { name, posts: tagPosts }] of tagMap) {
    const dir = join(BLOG_DIR, 'tag', tslug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), page({
      title: `#${name} Articles — etherGTM Blog`,
      description: `Articles tagged "${name}" from the etherGTM team.`,
      canonical: `${SITE_URL}/blog/tag/${tslug}/`,
      bodyHtml: renderTagBody(name, tagPosts),
    }));
  }

  const authorMap = new Map();
  for (const post of posts) {
    const aslug = slugify(post.author);
    if (!authorMap.has(aslug)) authorMap.set(aslug, { name: post.author, posts: [] });
    authorMap.get(aslug).posts.push(post);
  }
  for (const [aslug, { name, posts: authorPosts }] of authorMap) {
    const dir = join(BLOG_DIR, 'author', aslug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), page({
      title: `${name} — etherGTM Blog`,
      description: `Articles written by ${name}.`,
      canonical: `${SITE_URL}/blog/author/${aslug}/`,
      bodyHtml: renderAuthorBody(name, authorPosts),
    }));
  }

  const staticUrls = ['/', '/email-outbound.html', '/linkedin-outbound.html', '/blog/'];
  const postUrls = posts.map(p => `/blog/${p.slug}/`);
  const categoryUrls = CATEGORIES.map(c => `/blog/category/${c.slug}/`);
  const tagUrls = [...tagMap.keys()].map(t => `/blog/tag/${t}/`);
  const authorUrls = [...authorMap.keys()].map(a => `/blog/author/${a}/`);
  const allUrls = [...staticUrls, ...postUrls, ...categoryUrls, ...tagUrls, ...authorUrls];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}
</urlset>
`;
  await writeFile(join(ROOT, 'sitemap.xml'), sitemapXml);

  const rssItems = posts.map(p => `
  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${SITE_URL}/blog/${p.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}/</guid>
    <description>${escapeXml(p.description)}</description>
    <author>${escapeXml(p.author)}</author>
    <category>${escapeXml(p.category)}</category>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
  </item>`).join('');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${SITE_NAME} Blog</title>
  <link>${SITE_URL}/blog/</link>
  <description>Outbound, GTM, AI automation, and RevOps playbooks from the etherGTM team.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${rssItems}
</channel>
</rss>
`;
  await writeFile(join(ROOT, 'rss.xml'), rssXml);

  console.log(`Built ${posts.length} posts, ${CATEGORIES.length} categories, ${tagMap.size} tags, ${authorMap.size} authors.`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
