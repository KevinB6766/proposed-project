# React + TypeScript + Vite
# Have node installed
# npm run dev to spin up an instance

## GitHub Pages deployment
1. Set `homepage` in `package.json`:
   - `https://<YOUR_GITHUB_USER>.github.io/<YOUR_REPO>`
2. Install `gh-pages` (dev dependency):
   - `npm install --save-dev gh-pages`
3. Build and deploy:
   - `npm run deploy`

This runs `npm run build` then publishes `dist/` to the `gh-pages` branch. You can use GitHub Pages settings to serve from that branch.
