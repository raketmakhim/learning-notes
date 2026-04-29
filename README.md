# Learning Notes

A minimal static site for personal learning notes. Topics are written as Markdown files and rendered as collapsible cards with nested collapsible sections.

## Running locally

Browsers block file fetches, so you need a local server:

```bash
# Python
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Adding a topic

**1. Create a Markdown file in `content/`**

```
content/your-topic.md
```

**2. Add it to `topics.json`**

```json
[
  "content/concurrency.md",
  "content/your-topic.md"
]
```

Topics appear in the order they are listed.

## Markdown format

```markdown
# Topic Title — shown as the top-level card button

## Section Name

This becomes a nested collapsible inside the card.

**bold** and `inline code` work as expected.

## Another Section

More notes...

> **Gotcha:** This blockquote syntax renders as a red/orange warning callout.
> Use it for common mistakes or important caveats.
```

| Syntax | Renders as |
|---|---|
| `#` | Top-level card (one per file) |
| `##` | Nested collapsible section inside the card |
| `> **Gotcha:** ...` | Red/orange highlighted warning block |
| `**bold**` | Bold text |
| `` `code` `` | Inline code |

## Deploying to GitHub Pages

1. Push the repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)` folder
4. Your site will be live at `https://<username>.github.io/<repo>/`

After that, adding a topic is just: write the file, update `topics.json`, and push.
