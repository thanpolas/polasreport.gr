# polasreport.gr

Welcome to polasreport.gr

# Launch

```
jekyll serve -l --watch
```

## Iconography & Social Actions

We use Boxicons (https://boxicons.com) via CDN to provide consistent, lightweight social icons across the site. The stylesheet is loaded once in `_layouts/default.html` using:

```html
<link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css">
```

Usage example in templates:

```html
<a class="social-icon social-icon--x" href="https://x.com/username" aria-label="Open on X">
	<i class="bx bxl-twitter" aria-hidden="true"></i>
</a>
```

Notes:
- The `bxl` prefix indicates a brand icon (eg `bxl-youtube`, `bxl-tiktok`, `bxl-facebook-square`).
- We choose muted icons with subtle hover accents to maintain discrete legibility.
- The `youtube` link is shown in the same social action bar and contains a label (`Watch on YouTube`) to clarify action, displayed on wider viewports and hidden on small screens.

## Design & UX Specification (Social Action Bar)

Goal: Provide a single, compact set of social actions on each post (watch on YouTube + available social channels) with an unobtrusive UI that preserves typographic rhythm and accessibility.

Constraints:
- Discrete visual weight; should not compete with headers or content.
- Accessible via keyboard and screen readers.
- Icons must be consistent, not too large, and use subtle hover states to indicate interactivity.

Layout & spacing:
- Place the social action bar under the post meta (date/time), centered-left aligned under the title.
- Use a horizontal flex container with spacing (gap ~0.6rem) for icons.
- Each action should be a pill: min-width ~34px, height ~30px, small horizontal padding.

Typography:
- Small labels (`Watch on YouTube`) use existing content font with 0.95rem size, weight 600. Hidden on small screens (`max-width: 720px`).
- Icon color: `var(--muted)` by default; YouTube uses subtle red `#ff0000`.

Hover states:
- Use very subtle background tint per platform (rgba of brand color at 0.06 opacity). The icon color will also adopt the brand color on hover.
- Add keyboard focus outline for accessibility: `outline: 3px solid rgba(10,102,194,0.12)` with small offset.

Accessibility:
- All social links have `aria-label` and `title` attributes for screen readers and tooltips.
- Links open in a new tab and include `rel="noopener noreferrer"`.

Implementation notes for programmer:
- Add platform icon classes and links to post front-matter (`youtube`, `x`/`twitter`, `tiktok`, `facebook`).
- Render the social action bar when at least one of these exists.
- Use `bxl-*` icons from Boxicons. Keep all CSS in `assets/css/main.css` and avoid inline styles in templates.

