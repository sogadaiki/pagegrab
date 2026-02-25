# PageGrab

Chrome extension that extracts page text as Markdown and downloads images locally. Built for feeding web content into AI tools like Claude Code.

## Why?

- **X (Twitter) blocks AI bots** - Claude Code can't read tweets or X articles
- **FireShot's free plan** produces blurry screenshots that AI can't parse
- **Long-form X articles (Notes)** need both text AND images extracted together

PageGrab solves all three: one click to extract structured Markdown + download all images locally.

## Features

- **Text extraction** - DOM-based, works on any page (logged-in session = no bot blocking)
- **X (Twitter) optimized** - Handles tweets, threads, Notes (long-form posts), and articles
- **Image download** - All images saved locally with absolute paths in Markdown
- **Markdown output** - Frontmatter metadata + structured content, ready for AI consumption
- **Zero external dependencies** - Runs entirely in the browser, no API keys needed

## Install

Developer mode install (not on Chrome Web Store):

1. Clone this repo
2. `npm install && npm run build`
3. Open `chrome://extensions` in Chrome
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** and select the `dist/` folder

## Usage

1. Navigate to any page (X tweet, article, blog post, etc.)
2. Click the PageGrab icon in the toolbar
3. Click **Extract Text**
4. Files are saved to `~/Downloads/pagegrab/`:
   - `text/` - Markdown files
   - `images/` - Downloaded images organized by page

### With Claude Code

```bash
# Read the extracted text
claude "Read /Users/you/Downloads/pagegrab/text/x.com_user_status_123_2025-01-01.md"

# Read an image from the article
claude "Read /Users/you/Downloads/pagegrab/images/x.com_user_status_123_2025-01-01/img_001.jpg"
```

## Output Format

```markdown
---
source: x.com
type: x-article
author: "@username"
url: https://x.com/user/status/123
extracted_at: 2025-01-01T00:00:00Z
---

# Article Title

Article content in Markdown...

![image](/Users/you/Downloads/pagegrab/images/.../img_001.jpg)

---

## Images (local paths)

- /Users/you/Downloads/pagegrab/images/.../img_001.jpg
- /Users/you/Downloads/pagegrab/images/.../img_002.png
```

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript (strict mode)
- esbuild (zero-config bundler)
- No external runtime dependencies

## Development

```bash
npm install
npm run build        # Build once
npm run watch        # Watch mode
npm run type-check   # TypeScript check
```

## License

MIT
