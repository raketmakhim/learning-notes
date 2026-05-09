# Learning Notes

A minimal static site for personal learning notes. Topics are written as Markdown files, organised into tabs by folder, and rendered as collapsible cards with nested collapsible sections.

## Running locally

Browsers block file fetches, so you need a local server:

```bash
python serve.py
```

Or manually:

```bash
python -m http.server 8080
# open http://localhost:8080
```

## Adding a tab / folder

**1. Create a folder inside `content/`**

```
content/
  java/
    concurrency.md
  python/
    decorators.md
```

**2. Register it in `topics.json`**

```json
[
  {
    "tab": "Java",
    "topics": [
      "content/java/concurrency.md"
    ]
  },
  {
    "tab": "Python",
    "topics": [
      "content/python/decorators.md"
    ]
  }
]
```

Add as many tabs as you like — the tab bar renders dynamically from this file. If there is only one tab, the tab bar is hidden automatically.

## Markdown format

```markdown
# Topic Title — shown as the card button

## Section Name

This becomes a nested collapsible inside the card.

**Term**: definition or explanation here.

## Another Section

More notes...

> **Gotcha:** Red/orange warning callout for important caveats.
```

| Syntax | Renders as |
|---|---|
| `#` | Top-level card (one per file) |
| `##` | Nested collapsible section inside the card |
| `**Term**` | Orange highlighted term label |
| `` `code` `` | Inline code |
| `> **Gotcha:** ...` | Red/orange warning block |

## Deploying to GitHub Pages

1. Push the repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)` folder
4. Live at `https://<username>.github.io/<repo>/`

After that: write a file, update `topics.json`, push.
