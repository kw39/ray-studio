# Ray Studio

A physics ray-diagram editor for teachers and students. Build clean reflection diagrams, explore a live plane-mirror example, and export your work for the classroom. Project data stays in your browser or in files you save. There are no accounts, analytics, or external APIs in the app.

## Quick start

### Use it online

[Open Ray Studio in your browser](https://kw39.github.io/ray-studio/)

No installation is required. Your diagrams stay in your browser or downloaded
project files; there is no cloud account or cross-device synchronization. Use
Save project and Open to transfer diagrams between the website and Windows app.
Their browser autosaves are separate. GitHub hosts the website and may retain
standard visitor logs under its privacy policy.

### Standalone Windows app — no Node.js needed

[Download Ray Studio for Windows x64](https://github.com/kw39/ray-studio/releases/download/v1.2.1/Ray-Studio-1.2.1-windows-x64.zip) · [Release details](https://github.com/kw39/ray-studio/releases/tag/v1.2.1)

Extract the packaged Windows download and double-click **Ray Studio.exe**. It opens the editor in your default browser. The executable includes its runtime and app files, works offline, and does not require administrator access or a Node.js installation. It targets Windows 10/11 x64 with a modern browser.

Keep the server window open while drawing. Close it or press **Ctrl+C** to stop. Launching the app again opens the running instance. This build is unsigned; Windows or your organization's policy may display an unknown-publisher warning or require a signed build.

The source ZIP from GitHub is different from the packaged executable. To build the executable from source, see [Development and Windows builds](#development-and-windows-builds).

### Windows from source

1. Install **[Node.js 24 LTS](https://nodejs.org/)** (24.19 or later in the 24.x series) if it is not already installed.
2. Download this repository using **Code → Download ZIP**, then extract the ZIP.
3. Double-click **Start Ray Studio.bat** in the extracted folder.

The launcher starts a local server and automatically opens Ray Studio in your default browser. Keep its terminal window open while using the app. Close the window or press **Ctrl+C** to stop the server. Running the launcher again opens the existing Ray Studio instance.

No build step or `npm install` is required. After downloading the app and installing Node.js, you can use it offline.

### macOS, Linux, or terminal users

With Node.js 24 installed, open a terminal in the app folder and run:

```sh
npm start -- --open
```

This starts the server and opens your default browser. Run `npm start` to start without opening a browser. The default address is **http://127.0.0.1:4173**. Windows PowerShell users can also run `./Start Ray Studio.ps1`.

## What you can do

- Draw mirrors, light rays, arrows, lines, measurements, dots, dashes, points, and observers.
- Move, resize, rotate, and style objects, with independently editable labels.
- Use a square grid with 5 × 5 subdivisions, adjustable dimensions, snapping, and real-world scale.
- Explore a live reflection example with a virtual image and correctly aligned ray extensions.
- Save editable projects, export PNG/SVG/PDF, and print clean diagrams.

To try it, choose **Load reflection example**, select the eye, and drag it. The rays update automatically.

## Troubleshooting

- **Node.js is missing:** install Node.js LTS, then reopen the launcher. If you installed it while a terminal was open, open a new terminal first.
- **Port 4173 is in use:** close the other server or choose another port. In PowerShell, run `$env:PORT = '4174'` followed by `npm start -- --open`.
- **The browser does not open:** open the address shown in the terminal manually.
- **The app stops loading:** keep the server window open. Start the launcher again if you closed it.
- **Opening index.html directly does not work:** use the launcher or a static web server because the app loads JavaScript as a module.

## Drawing and editing

- New dots have a diameter of one small grid square (40 drawing units). Their labels start beside the dot, and existing saved marker sizes remain unchanged.

- New labels and text start at 54 px. Select an attached label or text object and drag its square corner handle to resize it, or enter a font size in Properties (8–200 px). Saved projects retain their chosen font sizes.
- Choose **Text** (T), click the grid, and write in the Text field in Properties. Line breaks, bold, italic, alignment, rotation, and corner resizing are supported.
- Mirror hatch marks are one small square long. At default thickness, arrowheads are one small square high and wide; increasing thickness enlarges the heads too. Mirror hatching and measurement ticks follow their object's line thickness.
- Expanded property sections stay open while you edit the same object.

- Drag a drawing tool onto the page to place a default object. Or choose a tool, then click the beginning and end of a line. Click-and-drag also draws a single segment. Text, markers, and eyes need only one click.
- The Light ray tool continues from the previous endpoint. Press **Enter** or double-click to finish. **Escape** cancels the pending segment and returns to selection; completed segments remain.
- Click an object or its layer to select it. Drag to move, drag endpoint handles to reshape, and drag the round handle to rotate. Geometry and appearance can also be entered in Properties.
- Orange endpoint handles indicate shared ray junctions. Moving them or changing endpoint coordinates updates all connected rays. Snapping a ray endpoint onto another ray endpoint joins them. Duplicated and pasted objects receive independent nodes.
- To separate a connected segment, select it and use **Endpoint connections → Disconnect start / Disconnect end** in Properties. If both ends are shared, **Disconnect both endpoints** separates the entire segment. Its position stays unchanged until you move it. Other segments keep their existing connections. Disconnect supports undo/redo and is preserved in saved projects. Dragging an endpoint back onto another ray endpoint can reconnect it when Snap to objects is enabled.
- Grid snapping uses square intersections. Endpoint snapping uses other objects' endpoints, within a small screen-space tolerance; rays share nodes only with other rays. Disable snapping for free positioning.
- Mirrors have adjustable length, rotation, and reflective side. Hatching is always on the non-reflective side.
- Endpoint labels remain attached to arrows and objects. Drag the label itself to reposition it independently. Select a label and press Delete (or click Delete label) to remove only the text. The same controls work for observer names, point labels, and measurements. Labels follow their parent when it moves. Expand each endpoint label's controls to edit its offset, size, weight, italic style, and alignment.
- The eye is a side-view observer symbol with an editable name above it. Select the eye to edit its name or flip, rotate, and resize the symbol; select the name to move or delete it independently.
- **Dot** and **Dash** are separate toolbar tools for a filled dot or short horizontal dash. Each includes an editable label with the same independent dragging and deletion controls. Properties adjusts marker size or dash half-length, colour, thickness, and label text. They are saved as point markers in project files.
- **Grid size** sets the number of large-square rows and columns, from 2 to 30 each. Each large square contains exactly **5 × 5 small squares**. For example, 10 rows and 8 columns makes a portrait grid. Click Apply grid size to center all objects together on the resized page. Object sizes, relative spacing, labels, and connections stay unchanged. If the group exceeds a smaller page, enlarge the grid to reveal it. Grid resizing is undoable and saved in project files.
- Measurements stay horizontal or vertical. They calculate length using **Grid Scale**, or accept a custom value when automatic calculation is unchecked.
- Layers appear from front to back. Backward/Forward changes stacking one step at a time.
- The main Properties page contains Grid size, Grid Scale, and Layers. Selecting an object or label switches to only its related controls. Use **← Back** or click empty canvas to return to the main page. Layer ordering controls appear with the selected object's properties.
- Scroll to zoom around your pointer. Space + drag, middle-drag, or the Pan tool pans the page. Fit page restores the complete page view.

## Files and exports

- **Save project** downloads a versioned `.ray.json` project containing all editable objects, shared endpoints, scale, and grid settings.
- **Open** restores a saved project. New, Open, and loading the example are undoable.
- **Clear all** in the canvas toolbar removes all diagram objects and their labels, keeping the project name and grid settings. Undo restores the full diagram, including shared ray connections.
- The current diagram autosaves in this browser's local storage. Save a project file for a durable or transferable copy. Private browsing or clearing site data can remove the browser copy. Browser profiles and local addresses have separate storage; use Save project and Open to move your work between them.
- If an autosaved project cannot be opened, **Save recovery copy** downloads the original data for recovery. If browser storage is unavailable, the app shows a message to use Save project.
- **SVG** exports vector lines and editable SVG text, with no editor controls.
- **PNG** follows the selected grid dimensions at up to 2× resolution, capped at 4000 pixels on its longest edge. The export dialog shows the resulting pixel dimensions.
- **PDF** exports a single page matching the grid's proportions using a high-resolution raster image. Use SVG for a fully vector format.
- Export controls independently include/exclude the grid and the Grid Scale caption. Optional on-page scale markers follow the canvas setting.
- **Print diagram** opens the browser print dialog with the diagram alone.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Select / Pan / Ray / Label | V / H / R / T |
| Undo | Ctrl/⌘ Z |
| Redo | Ctrl/⌘ Shift Z or Ctrl/⌘ Y |
| Copy / Paste | Ctrl/⌘ C / V |
| Duplicate | Ctrl/⌘ D |
| Cut | Ctrl/⌘ X |
| Save project | Ctrl/⌘ S |
| Delete | Delete / Backspace |
| Nudge / larger nudge | Arrow keys / Shift + arrows |
| Fit / zoom | 0 / + / − |

## Scope

The default page is 4 large-square rows × 5 large-square columns, or 1000 × 800 drawing units. A small square is 40 units; a large square is 200 units. Grid Scale changes the real-world meaning of one **small square**. Geometry coordinates in Properties are measured in small squares, with the origin at the top-left. Positive rotation is clockwise. Existing projects without row/column settings open with the default grid size.

Ordinary diagrams use manual construction. The reflection example additionally supports live plane-mirror geometry. Selection is one object at a time. It prioritizes desktop and tablet; on narrow screens the Properties panel moves below the canvas. Touch placement and editing are supported, with zoom buttons for tablets.

**Load reflection example** creates a live example showing object AB, its virtual image A′B′ at equal distance behind the mirror, and an observer. Drag the observer, object, or mirror to recalculate the image and ray intersections. The eye remains on the object's side of the mirror. Orange rays obey the law of reflection and meet the eye; green dashed backward extensions are exactly collinear with the reflected rays. Rays that miss the finite reflective face are hidden. Calculated geometry is locked while **Live reflection** is enabled; labels and appearance remain editable. Disable it to construct rays manually. Disconnecting an example segment also disables live reflection. Live settings persist in saved projects and support undo/redo. Loading the example replaces the current diagram and can be undone.

## Development and Windows builds

The app runs without npm dependencies. Development tools are pinned in `package-lock.json`:

```sh
npm ci --ignore-scripts
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

Build on Windows x64:

```sh
npm run build:windows
npm run test:exe
```

The build downloads the official Node.js 24.19.0 runtime, checks its SHA-256 against the official distribution checksums, and embeds the app using Node's single-executable format. Build-time downloads require internet access. The resulting folder is `dist/Ray-Studio-1.2.1-windows-x64/`, including the executable, a quick-start guide, application license, runtime notices, checksum, and build metadata.

`test:exe` copies only the executable into an isolated folder, removes Node from its PATH, verifies the embedded assets, and runs the browser tests against it. These checks currently run locally; GitHub Actions is not yet enabled for this repository.

The readable editor source remains in `app.js`; `project-schema.mjs` validates and normalizes imported projects; `serve.cjs` serves only the app assets on loopback. `tests/` contains portable unit and browser tests, and `scripts/` contains verification and packaging commands. Generated builds and local test artifacts are ignored by Git.

## Publishing the website

GitHub Pages serves the `gh-pages` branch. After committing and pushing changes
to `main`, a maintainer with repository write access can run `npm run deploy:web`.
This publishes the four browser assets and MIT license from the committed source.
The command requires Git and GitHub authentication; visitors need neither.
GitHub then deploys the branch, usually within a few minutes. Pushing to `main`
alone does not update the website. The Windows release is updated separately.

To test the live website in PowerShell, run:

```powershell
$env:TEST_APP_URL = 'https://kw39.github.io/ray-studio/'
npm run test:browser
Remove-Item Env:TEST_APP_URL
```

## Contributing

Bug reports and improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for reporting details and development checks.

## License

Ray Studio is licensed under the [MIT License](LICENSE), copyright 2026 kw39. You may use, modify, and redistribute it, including commercially, while retaining the copyright and license notice. The software is provided without warranty.

The standalone executable embeds Node.js and its third-party components, which retain their own license terms. Their notices are supplied as `NODE-LICENSE.txt` and available with `Ray Studio.exe --licenses`. Windows packages include the application's MIT license as `LICENSE` in the extracted folder.
