# polasreport.gr

Welcome to polasreport.gr

## Launch Local

```
jekyll serve -l --watch
```

## Run locally with Docker (starefossen/github-pages)

Build + run in foreground:
```
docker compose up --build
```

Or build first, then run detached:
```
docker compose build
docker compose up -d
docker compose logs -f jekyll
```

Open browser: [http://localhost:4000](http://localhost:4000)



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

