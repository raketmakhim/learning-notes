async function loadTopics() {
  const res = await fetch('topics.json');
  if (!res.ok) throw new Error('Could not load topics.json');
  return res.json();
}

async function loadMarkdown(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.text();
}

function parseTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

// Splits the body (everything after the # title) into sections by ## headings.
// Returns [{ title: string | null, content: string }, ...]
// title is null for any intro text before the first ##.
function parseSections(markdown) {
  const body = markdown.replace(/^#[^\n]*\n?/, '').trim();
  const parts = body.split(/^(?=##\s)/m);
  const sections = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      const newlineIndex = trimmed.indexOf('\n');
      const title = newlineIndex === -1
        ? trimmed.slice(3).trim()
        : trimmed.slice(3, newlineIndex).trim();
      const content = newlineIndex === -1 ? '' : trimmed.slice(newlineIndex + 1).trim();
      sections.push({ title, content });
    } else {
      // Intro content before the first ##
      sections.push({ title: null, content: trimmed });
    }
  }

  return sections;
}

function buildChevron() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('chevron');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  poly.setAttribute('points', '5 8 10 13 15 8');
  svg.appendChild(poly);
  return svg;
}

function buildSection(title, contentHTML) {
  const section = document.createElement('div');
  section.className = 'section';

  const button = document.createElement('button');
  button.className = 'section-toggle';
  button.setAttribute('aria-expanded', 'false');

  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title';
  titleSpan.textContent = title;

  button.appendChild(titleSpan);
  button.appendChild(buildChevron());

  const wrapper = document.createElement('div');
  wrapper.className = 'section-body-wrapper';

  const body = document.createElement('div');
  body.className = 'section-body';
  body.innerHTML = contentHTML;

  wrapper.appendChild(body);

  button.addEventListener('click', () => {
    const isOpen = section.classList.toggle('open');
    button.setAttribute('aria-expanded', String(isOpen));
  });

  section.appendChild(button);
  section.appendChild(wrapper);
  return section;
}

function buildCard(title, sections) {
  const card = document.createElement('div');
  card.className = 'topic-card';

  const button = document.createElement('button');
  button.className = 'topic-toggle';
  button.setAttribute('aria-expanded', 'false');

  const titleSpan = document.createElement('span');
  titleSpan.className = 'topic-title';
  titleSpan.textContent = title;

  button.appendChild(titleSpan);
  button.appendChild(buildChevron());

  const wrapper = document.createElement('div');
  wrapper.className = 'topic-body-wrapper';

  const body = document.createElement('div');
  body.className = 'topic-body';

  for (const { title: sTitle, content } of sections) {
    const html = marked.parse(content);
    if (sTitle === null) {
      // Intro text — render inline without a collapsible
      const intro = document.createElement('div');
      intro.className = 'topic-intro';
      intro.innerHTML = html;
      body.appendChild(intro);
    } else {
      body.appendChild(buildSection(sTitle, html));
    }
  }

  wrapper.appendChild(body);

  button.addEventListener('click', () => {
    const isOpen = card.classList.toggle('open');
    button.setAttribute('aria-expanded', String(isOpen));
  });

  card.appendChild(button);
  card.appendChild(wrapper);
  return card;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function init() {
  const container = document.getElementById('topics');

  try {
    const paths = await loadTopics();
    container.innerHTML = '';

    for (const path of paths) {
      try {
        const markdown = await loadMarkdown(path);
        const title = parseTitle(markdown);
        const sections = parseSections(markdown);
        const card = buildCard(title, sections);
        container.appendChild(card);
      } catch (err) {
        console.warn(`Skipping ${path}:`, err.message);
      }
    }

    if (container.children.length === 0) {
      container.innerHTML = '<p class="error">No topics found. Add paths to topics.json.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p class="error">Error: ${escapeHTML(err.message)}</p>`;
  }
}

init();
