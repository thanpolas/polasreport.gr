# copilot-instructions for polasreport.gr

This repository is a Jekyll-based static site. The source is the repo root (layouts, includes, posts, assets). The generated site is in `_site/` — do not edit `_site/` directly.

Big picture
- Static site using Jekyll (theme: `minima`) with site-wide config in `_config.yml`.
- Content: posts live in `_posts/` (YYYY-MM-DD-title.md). Other pages live at root (e.g., `index.markdown`) and in `polas-spectrum/`.
- Templates: `_layouts/` and `_includes/` control markup (see `_layouts/default.html`, includes folder).
- Assets: `assets/` contains `css/`, images, and other static files.

Build & dev workflows (exact commands)
- Native Ruby/Bundler (recommended if you have Ruby):
  - `bundle install`
  - `bundle exec jekyll build` (produces `_site/`)
  - `bundle exec jekyll serve --livereload` (local preview)
- Docker (consistent environment; repo includes `Dockerfile` and `docker-compose.yml`):
  - `docker compose up --build` (or `docker-compose up --build`)
  - The compose file maps ports `4000` (site) and `35729` (livereload). Set `JEKYLL_GITHUB_TOKEN` in env when needed.

Stylesheet architecture (SCSS + BEM)
- Source: `_sass/` (Jekyll compiles to `assets/css/main.css`)
- Entry point: `assets/css/main.scss` (imports `_sass/main.scss`)
- Main structure: `_sass/main.scss` imports all partials in order:
  - `_variables.scss` (colors, spacing, fonts, breakpoints, mixins)
  - `_reset.scss`, `_typography.scss`, `_layout.scss` (base styles)
  - `components/` folder (header, footer, post-list, media-gallery, video, social-icons, cta)
  - `_utilities.scss` (utility classes)
  - `_polas-spectrum.scss` (page-specific overrides)
  - `_responsive.scss` (media queries)
- Naming: BEM convention (`.component__element--modifier`) for clarity
- Variables: All colors, spacing, breakpoints centralized in `_variables.scss`
- Mixins: `@include respond-to($breakpoint)` for media queries, `@include transition()` for smooth interactions

Project-specific conventions
- Front matter: posts use standard Jekyll front matter. The site uses a `media` front-matter array in some posts (see `index.markdown` loop expecting `post.media` with `type`, `url`, and optional `caption`).
- Future posts: `_config.yml` has `future: true`, so future-dated posts are included in builds.
- Base URL: `_config.yml` sets `baseurl: "/"` and `url: "https://polasreport.gr"`. Respect these when generating links.

Important files to inspect when changing structure
- `_config.yml` — global settings and plugins
- `Gemfile` / `Gemfile.lock` — Jekyll and plugin versions
- `Dockerfile` / `docker-compose.yml` — containerized dev workflow
- `_layouts/default.html`, `_layouts/post.html`, `_includes/` — templates and partials
- `_posts/` — canonical example: `_posts/2025-12-10-trapezes-yperkerdh.md`
- `assets/css/main.css` — site styling

Integration notes
- `CNAME` present — site is served as `polasreport.gr` on GitHub Pages; do not remove unless changing hosting.
- The repo contains a generated `_site/` folder. Avoid editing or relying on changes in `_site/` (it's the build artifact).

What to avoid/change carefully
- Do not edit `_site/` — regenerate from source instead.
- When changing plugins or Jekyll version, run `bundle install` and test with `bundle exec jekyll serve` or via Docker.

If you're uncertain
- Grep for examples in the repo (e.g., `_posts/` and `index.markdown`) to follow existing patterns.

If anything above is unclear or you want specific snippets (front-matter `media` example, a recommended `bundle` command with flags, or Docker compose tips), tell me which area to expand.
