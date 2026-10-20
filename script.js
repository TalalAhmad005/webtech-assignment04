const STORAGE_KEY = 'markdown-slides';
const editor = document.getElementById('editor');
const get = id => document.getElementById(id);
let slides = [];
let current = 0;
let presenting = false;

const starter = `# My Presentation

Welcome to my slides.

---

# Second Slide

## Markdown supports

- Headings
- **Bold** and *italic*
- Lists and links`;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function inline(text) {
  let value = escapeHtml(text);
  const tokens = [];
  value = value.replace(/`([^`]+)`/g, (_, code) => {
    tokens.push(`<code>${code}</code>`);
    return `@@CODE${tokens.length - 1}@@`;
  });
  value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  value = value.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/__(.*?)__/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  value = value.replace(/_([^_]+)_/g, '<em>$1</em>');
  return value.replace(/@@CODE(\d+)@@/g, (_, index) => tokens[Number(index)]);
}

function renderMarkdown(source) {
  const output = [];
  let list = '';
  let code = false;
  let codeLines = [];
  const closeList = () => { if (list) { output.push(`</${list}>`); list = ''; } };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      closeList();
      if (code) { output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); codeLines = []; }
      code = !code;
      continue;
    }
    if (code) { codeLines.push(raw); continue; }
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (list !== type) { closeList(); output.push(`<${type}>`); list = type; }
      output.push(`<li>${inline((bullet || numbered)[1])}</li>`);
    } else if (line.startsWith('>')) {
      closeList(); output.push(`<blockquote>${inline(line.slice(1).trim())}</blockquote>`);
    } else {
      closeList(); output.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  if (codeLines.length) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  return output.join('') || '<p>Empty slide</p>';
}

function parseSlides(text) {
  const groups = [[]];
  let fenced = false;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && /^\s*---\s*$/.test(line)) groups.push([]);
    else groups[groups.length - 1].push(line);
  }
  return groups.map(lines => lines.join('\n').trim());
}

function showSlide() {
  const html = renderMarkdown(slides[current] || '');
  get('previewSlide').innerHTML = html;
  get('presentationSlide').innerHTML = html;
  const count = `${current + 1} / ${slides.length}`;
  get('previewCount').textContent = count;
  get('presentationCount').textContent = count;
  for (const id of ['previous','presentPrevious']) get(id).disabled = current === 0;
  for (const id of ['next','presentNext']) get(id).disabled = current === slides.length - 1;
  for (const id of ['previewFullscreen','presentFullscreen']) get(id).textContent = document.fullscreenElement ? '⤢' : '⛶';
}

function updateSlides() {
  slides = parseSlides(editor.value);
  current = Math.min(current, slides.length - 1);
  get('status').textContent = 'Unsaved changes';
  showSlide();
}

function move(amount) {
  current = Math.max(0, Math.min(current + amount, slides.length - 1));
  showSlide();
}

function saveSlides() {
  try { localStorage.setItem(STORAGE_KEY, editor.value); get('status').textContent = 'Saved'; }
  catch { get('status').textContent = 'Save failed'; }
}

function enterPresentation() {
  presenting = true;
  get('presentation').classList.remove('hidden');
  showSlide();
}

async function exitPresentation() {
  if (document.fullscreenElement) await document.exitFullscreen();
  presenting = false;
  get('presentation').classList.add('hidden');
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await (presenting ? get('presentation') : get('previewSlide')).requestFullscreen();
  } catch { get('status').textContent = 'Fullscreen unavailable'; }
  showSlide();
}

editor.addEventListener('input', updateSlides);
get('saveBtn').addEventListener('click', saveSlides);
get('presentBtn').addEventListener('click', enterPresentation);
get('exitBtn').addEventListener('click', exitPresentation);
get('previous').addEventListener('click', () => move(-1));
get('next').addEventListener('click', () => move(1));
get('presentPrevious').addEventListener('click', () => move(-1));
get('presentNext').addEventListener('click', () => move(1));
get('previewFullscreen').addEventListener('click', toggleFullscreen);
get('presentFullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', showSlide);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveSlides(); return; }
  if (event.key === 'Escape' && presenting) { exitPresentation(); return; }
  if (event.key === 'F11') { event.preventDefault(); toggleFullscreen(); return; }
  if (document.activeElement === editor || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
});

try { editor.value = localStorage.getItem(STORAGE_KEY) ?? starter; }
catch { editor.value = starter; }
updateSlides();
get('status').textContent = 'Ready';
