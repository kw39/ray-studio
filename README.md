# Ray Studio

A self-contained physics ray-diagram editor for teachers and students. All project data stays in your browser or in files you save. The app has no external dependencies, analytics, accounts, or network APIs.

## Quick start

### Windows

1. Install the **LTS version of [Node.js](https://nodejs.org/)** if it is not already installed.
2. Download this repository using **Code → Download ZIP**, then extract the ZIP.
3. Double-click **Start Ray Studio.bat** in the extracted folder.

The launcher starts a local server and automatically opens Ray Studio in your default browser. Keep its terminal window open while using the app. Close the window or press **Ctrl+C** to stop the server. Running the launcher again opens the existing Ray Studio instance.

No build step or `npm install` is required. After downloading the app and installing Node.js, you can use it offline.

### macOS, Linux, or terminal users

With Node.js installed, open a terminal in the app folder and run:

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
- The current diagram autosaves in this browser's local storage. Save a project file for a durable or transferable copy. Private browsing or clearing site data can remove the browser copy.
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

## Verification

Run `npm run check` to check JavaScript syntax. For a quick functional check, load the reflection example, drag the observer, resize the grid, undo, save and reopen a project, and export an SVG. Run `npm test` to verify server startup and launcher behavior.

Files: `index.html` provides the interface, `styles.css` the responsive layout, `app.js` the SVG editor and export logic, and `serve.cjs` the local-only static server.
