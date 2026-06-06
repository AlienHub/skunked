# SKUNKED Site

Static marketing and dataset browsing pages for SKUNKED Open Data.

## Files

- `index.html`: landing page
- `dataset.html`: public dataset browser
- `styles.css`: shared visual system
- `index.js` / `dataset.js`: data fetching and interaction logic

## Local Preview

Use any static server from the `site/` directory, for example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## API Base

By default pages call the independent Open Data API:

`https://skunked-open-data.zhouxiansheng1958.workers.dev`

Override with query parameter:

- `?api=https://your-worker.example.workers.dev`
