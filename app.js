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

function parseSections(markdown) {
  // Strip the top-level # title line so it isn't treated as content
  const body = markdown.replace(/^#[^\n]*\n?/, '').trim();

  // Split on ## headings using a lookahead so the '## ' is kept at the
  // start of each part rather than consumed by the split delimiter
  const parts = body.split(/^(?=##\s)/m);
  const sections = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (/^##\s/.test(trimmed)) {
      // Extract the heading text and the body that follows it
      const newlineIndex = trimmed.indexOf('\n');
      const title = newlineIndex === -1
        ? trimmed.slice(3).trim()
        : trimmed.slice(3, newlineIndex).trim();
      const content = newlineIndex === -1 ? '' : trimmed.slice(newlineIndex + 1).trim();
      sections.push({ title, content });
    } else {
      // Content that appears before the first ## heading becomes an intro
      // block rendered directly inside the card without a toggle
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

  // The wrapper exists as a CSS hook for the max-height collapse animation.
  // The inner body holds the actual content; the wrapper is what transitions.
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

  // See buildSection — same wrapper/body pattern for the collapse animation
  const wrapper = document.createElement('div');
  wrapper.className = 'topic-body-wrapper';

  const body = document.createElement('div');
  body.className = 'topic-body';

  for (const { title: sTitle, content } of sections) {
    const html = marked.parse(content);
    if (sTitle === null) {
      // Intro content (before the first ## heading) is rendered flat,
      // not inside a collapsible section
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

function buildTabBar(entries) {
  const bar = document.createElement('div');
  bar.className = 'tab-bar';
  bar.setAttribute('role', 'tablist');

  entries.forEach(({ group, el: groupEl }, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = group.tab;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');

    btn.addEventListener('click', () => {
      // Deactivate all tabs, then activate only the clicked one
      bar.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      // Show only the group whose index matches the clicked tab
      entries.forEach(({ el }, j) => el.classList.toggle('active', i === j));
    });

    bar.appendChild(btn);
  });

  return bar;
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
    const groups = await loadTopics();
    container.innerHTML = '';

    const entries = [];

    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'topic-group';

      // Fetch all files in this group in parallel. allSettled (rather than
      // Promise.all) ensures a single failed fetch doesn't abort the rest —
      // each result is checked individually below
      const results = await Promise.allSettled(group.topics.map(loadMarkdown));

      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.warn(`Skipping ${group.topics[i]}:`, result.reason.message);
          return;
        }
        const markdown = result.value;
        const title = parseTitle(markdown);
        const sections = parseSections(markdown);
        const card = buildCard(title, sections);
        groupEl.appendChild(card);
      });

      entries.push({ group, el: groupEl });
    }

    // Only render tab bar when there is more than one tab
    if (entries.length > 1) {
      container.appendChild(buildTabBar(entries));
    }

    entries.forEach(({ el }, i) => {
      if (i === 0) el.classList.add('active');
      container.appendChild(el);
    });

    if (entries.every(({ el }) => el.children.length === 0)) {
      container.innerHTML = '<p class="error">No topics found. Add paths to topics.json.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p class="error">Error: ${escapeHTML(err.message)}</p>`;
  }
}

init();
