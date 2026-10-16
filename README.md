# VidCutMin

A minimal, self-contained browser video editor. No server, no build step, no dependencies — open `index.html` (or serve the folder) and edit.

Derived from the ClipQuotes video editor UI (`settings_manager/templates/video_editor.html` — three-panel NLE layout: cuts list | preview + canvas timeline | clip settings).

## Features

- Open video/audio via file picker or drag-and-drop anywhere
- In/Out marks (`I` / `O`), cut at playhead (`N`), Mark→Cut
- Canvas timeline: ruler, colored cut blocks, drag edges to trim, drag body to move, click to seek
- Cuts panel: select, rename, delete; per-cut start/end times
- Clip settings: name, in/out, fade in/out (metadata), volume, caption text
- Play sequence: plays all cuts back-to-back
- Export EDL/JSON + generated ffmpeg `render.sh` concat script
- Render WebM in-browser via canvas `captureStream` + `MediaRecorder` (per-cut volume applied; fades not yet applied during render)

## Skins

Three switchable skins (top-right selector, persisted in `localStorage`):

| Skin | File | Look |
|---|---|---|
| SnapCut | `css/skins/snapcut.css` | Dark indigo, ClipQuotes-derived |
| ShotCut | `css/skins/shotcut.css` | Gray pro-NLE, orange accent (Shotcut/Kdenlive-style) |
| ArtCraft | `css/skins/artcraft.css` | Light, warm, chunky craft-tool look |

Skins are pure CSS custom-property themes over `css/base.css`. Add a skin by creating `css/skins/<name>.css` with an `html[data-skin="<name>"]` block, then add an `<option>` in `index.html`.

## Keyboard

`Space` play/pause · `←`/`→` frame step · `Shift+←/→` 5s · `I`/`O` marks · `N` new cut · `Del` delete selected cut

## Run

```bash
# any static server, e.g.:
python3 -m http.server 8080 --bind 0.0.0.0
# then open http://127.0.0.1:8080
```

Opening `index.html` directly via `file://` also works (blob media URLs only).

## Layout

```
index.html        markup + skin selector
css/base.css      layout + widgets (skin-agnostic)
css/skins/*.css   theme variables only
js/app.js         state, timeline canvas, playback, export
```
