# For Bianca

A birthday scrapbook with personal letters, sender photos, and Spotify players. Built with plain HTML, CSS, and JavaScript.

## Local preview

Run from this folder:

```sh
python3 -m http.server 8001
```

Open http://localhost:8001.

## Content

- `birthday-content.js` contains the letters, song links, and photo lists.
- `assets/senders/` contains the photos grouped by sender.
- `images/` contains decorative stickers.
- `script.js` handles envelopes, galleries, and music players.
- `scrapbook.css` contains the scrapbook layout and responsive styles.

When changing photos, update both the sender's `photos` and the `memories` gallery list. Photo URLs use version parameters so replaced images refresh in browsers.

## Publishing

Repository: https://github.com/ochavekarylleb/forbianca

Website after deployment: https://ochavekarylleb.github.io/forbianca/

The GitHub Pages workflow publishes pushes to `main`. In Settings → Pages, set the source to **GitHub Actions**. No custom domain or build dependencies are required.
