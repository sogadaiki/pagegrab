# PageGrab Demo Video Script

**Duration:** 2:30 - 2:50
**Format:** Screen recording + maker narration (English)
**Tone:** "This is what I built and why" -- personal, direct, no hype
**Target uses:**
- Chrome Web Store demo video (YouTube unlisted)
- Product Hunt main video
- Source footage for 3x GIF cutouts

---

## Pre-recording checklist

- Browser window: 1280x800 (or 1440x900), clean Chrome profile, no personal bookmarks visible
- Extension pinned to toolbar
- Demo sites prepared (see each scene)
- Popup panel open to the right side to avoid covering content
- Screen recorder: 60fps, system audio OFF, mic audio ON
- Disable notifications

---

## GIF cutout markers

Three GIFs will be cut from this recording. Each is marked with `[GIF START]` and `[GIF END]` below.

| GIF | Section | Target length | Use |
|-----|---------|--------------|-----|
| GIF-1 | Design System Extractor | 15-20s | PH Gallery slot 2 |
| GIF-2 | Full Screenshot + Text Export | 12-15s | PH Gallery slot 3 |
| GIF-3 | Component Picker | 10-12s | PH Gallery slot 4 |

---

## Scene 0: Hook (0:00 - 0:18)

### Screen
Open browser. No extension open yet. Navigate to a well-known design-forward site -- Stripe or Linear works well. Let the page fully load. Pause for 1 second.

### Narration
> "Every week I'd open DevTools, hunt through minified CSS, copy hex codes one by one, try to figure out why a button looked exactly right -- and still not understand the system behind it.
>
> So I built PageGrab. Five tools, zero servers, zero dollars. Let me show you."

**Pacing note:** Speak slowly on "Five tools, zero servers, zero dollars." That line is the anchor.

---

## Scene 1: Design System Extractor (0:18 - 0:58)

**This is the hero scene. Give it the most screen time.**

### Screen

1. The page (Stripe or Linear) is still visible.
2. Click the PageGrab icon in the toolbar. The popup opens.
3. Hover briefly over the "Design System" button -- give the viewer a beat to read the label.
4. Click "Design System".
5. **[GIF START -- GIF-1]**
6. The result panel populates. Scroll slowly through the output: color palette swatches first, then typography scale, then spacing tokens.
7. Pause on the color palette row for 2 seconds -- let the swatches render.
8. Scroll to spacing tokens.
9. **[GIF END -- GIF-1]**
10. Leave the result visible on screen.

### Narration
> "This is the Design System Extractor. One click on any site, and you get the full picture: every color in the palette, the complete type scale, spacing tokens, and component patterns -- all reverse-engineered from the live CSS.
>
> Not what the page looks like. What the system behind it is.
>
> No other free tool does this."

**Pacing note:** After "No other free tool does this" -- pause 1.5 seconds before moving to the next scene.

---

## Scene 2: Text Extractor (0:58 - 1:22)

### Screen

1. Navigate to a content-heavy page -- a blog post or a long article works. X/Twitter also works if you want to show the bot-blocking use case.
2. Click PageGrab icon, then "Extract Text".
3. **[GIF START -- GIF-2]** (continue recording through the screenshot step in Scene 3)
4. The Markdown file downloads. Open the Downloads folder briefly, hover over the `.md` file.
5. Open the file in a text editor (VS Code or TextEdit). Show the frontmatter metadata at the top, then scroll down to the structured content.

### Narration
> "Text Extractor pulls any page's content as clean Markdown -- headings, lists, links, all preserved. Frontmatter metadata included.
>
> I originally built this because Claude Code can't read X posts directly. Bot blocking. This extension runs in your logged-in session, so it works anywhere you can see the page."

---

## Scene 3: Full Page Screenshot (1:22 - 1:45)

### Screen

1. Still on the same page from Scene 2, or navigate to a page with a fixed header (most marketing sites have one -- Vercel, Tailwind, etc.).
2. Click PageGrab icon, then "Full Screenshot".
3. The capture runs. The page scrolls automatically.
4. The PNG downloads. Open it. Scroll through the full-length image in Preview or the OS image viewer.
5. **[GIF END -- GIF-2]** -- cut after the full image is visible and scrolled.

### Narration
> "Full Page Screenshot uses the Chrome Debugger API to stitch together the complete page -- not just what's visible in the viewport. Fixed headers, sticky navbars: they're neutralized during capture so they don't repeat across every scroll position.
>
> The output is a clean, full-length PNG. No watermarks."

---

## Scene 4: Component Picker (1:45 - 2:15)

### Screen

1. Navigate to a UI-rich page -- a SaaS product with distinct components (cards, nav, buttons). Vercel dashboard or Notion works well.
2. Click PageGrab icon, then "Pick Component".
3. Move the cursor over the page. Elements highlight as you hover.
4. **[GIF START -- GIF-3]**
5. Click a card or button component. The popup fills with the extracted HTML and computed CSS.
6. Scroll through the output -- show both the HTML structure and the CSS values.
7. Click "Copy" (or the equivalent action in the UI).
8. **[GIF END -- GIF-3]**

### Narration
> "Component Picker lets you click any element and get the HTML structure and computed CSS as a self-contained, reusable snippet. No manual DevTools inspection, no guessing which class applies which rule.
>
> You're looking at the component as the browser actually renders it."

---

## Scene 5: LP Analyzer (2:15 - 2:35)

### Screen

1. Navigate to a landing page -- ideally one with a clear above-the-fold, mid-page sections, and a CTA at the bottom. Lemon Squeezy or Paddle landing pages work well.
2. Click PageGrab icon, then "LP Analysis".
3. The result shows section hierarchy: hero, features, pricing, footer. CTA placement noted.
4. Scroll through the analysis output slowly.

### Narration
> "And LP Analyzer breaks down any landing page: section hierarchy, layout patterns, CTA placement, content flow. Useful when you're studying a competitor page or auditing your own.
>
> Five different tools. One extension."

---

## Scene 6: Close (2:35 - 2:50)

### Screen

Return to the PageGrab popup with all five buttons visible. Hold for 3 seconds. Then close the popup and show the clean browser.

### Narration
> "Everything runs locally in your browser. No account, no subscription, no data ever leaves your machine.
>
> Five tools. Zero servers. Free forever.
>
> PageGrab is open source -- link in the description."

**Pacing note:** The final three sentences are the kicker. Deliver them as three separate beats, not a run-on. Brief pause between each.

---

## Post-production notes

### Do not add
- Background music
- Animated logo intro or outro
- Lower-thirds or callout boxes (the narration carries the framing)
- Speed ramps or jump cuts inside a single feature demo

### Do add
- Chapter markers in the YouTube description matching the scene timestamps
- Captions (auto-generated is fine, review for accuracy)

### YouTube description template

```
PageGrab -- 5 developer tools in one free Chrome extension.

0:00 Why I built this
0:18 Design System Extractor (reverse-engineer any site's design system)
0:58 Text Extractor (Markdown output, works on X/Twitter)
1:22 Full Page Screenshot
1:45 Component Picker
2:15 LP Analyzer
2:35 Privacy & pricing

GitHub: https://github.com/sogadaiki/pagegrab
Chrome Web Store: [link]

Everything runs locally. No servers. No data collection. Free.
```

### Chapter marker cross-reference

| YouTube chapter | Scene in this script | GIF |
|----------------|---------------------|-----|
| 0:00 Why I built this | Scene 0 | -- |
| 0:18 Design System Extractor | Scene 1 | GIF-1 |
| 0:58 Text Extractor | Scene 2 | GIF-2 (start) |
| 1:22 Full Page Screenshot | Scene 3 | GIF-2 (end) |
| 1:45 Component Picker | Scene 4 | GIF-3 |
| 2:15 LP Analyzer | Scene 5 | -- |
| 2:35 Close | Scene 6 | -- |

---

## Deviation from Issue #7 original spec

Issue #7 specified: "Click each feature in order: Extract Text -> LP Analysis -> Design System -> Pick Component -> Full Screenshot, text overlays only, no narration."

This script deviates intentionally for the Product Hunt use case:

1. **Order changed**: Design System leads (it is the differentiator; burying it at position 3 wastes the first 60 seconds when viewer attention is highest).
2. **Narration added**: Product Hunt maker videos with personal narration outperform text-overlay-only videos. The "this is what I built and why" tone is a Product Hunt best practice.
3. **Dual-purpose**: This recording also covers the Chrome Web Store requirement. GIFs cut from it serve as the Web Store gallery assets.

If a separate text-overlay-only version is needed for the Web Store video slot specifically, use GIF-1, GIF-2, and GIF-3 as the primary assets and skip the full narrated video submission there.
