# Design Vault

A one-page download site for free design files, hosted on GitHub Pages.

- Live site: https://buyfabshit-lab.github.io/testrepo/
- Add files: drop them in `files/` (drag and drop on GitHub works). The page lists them automatically.
- Publishing: `.github/workflows/design-vault-pages.yml` republishes the site whenever this folder changes on the default branch.

No build step. `index.html` asks the GitHub API for the contents of `files/` and renders a download card for each one.
