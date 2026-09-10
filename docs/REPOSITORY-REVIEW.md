# Repository review — 10 September 2026

Working level: maintained project and Windows delivery readiness. The vanilla
HTML/CSS/SVG editor is retained; no UI framework or desktop browser bundle was added.

## Findings addressed

| Finding | Improvement | Evidence |
| --- | --- | --- |
| The local server served repository files, including `.git/config` | Exact public-asset allowlist; loopback host validation; GET/HEAD only; browser security headers | Server regression tests cover repository paths, wrong hosts, request methods, HEAD, and headers |
| Some imported label and geometry properties reached SVG without complete validation | Dedicated project schema rebuilds the supported data shape, checks numeric ranges and node IDs, and normalizes attribute enums | Schema tests and browser import tests cover malformed fields, prototype-like IDs, missing endpoints, and injected attributes |
| Unreadable autosaved data was overwritten on startup | Preserve a recovery copy before starting a new example; provide a download button; stop autosave if recovery storage fails | Browser recovery test |
| Fractional lengths such as 3.5 squares failed HTML input step validation | Accept fractional lengths and angles within the supported ranges | Browser property-edit regression test |
| Development and browser checks depended on local machine paths | Pinned development dependencies, lockfile, portable tests, documented commands, isolated test server | Unit suite and browser workflows run locally |
| Source layout was difficult to read and input validation was mixed into UI code | Consistent formatting and an import-validation module with direct tests | Syntax checks and editor regression tests |
| No no-install Windows delivery path | One executable embeds the app and a checksum-verified official runtime; license notices and build metadata included | Isolated executable test removes Node from PATH, serves embedded assets, and runs browser workflows |
| No repository automation | Read-only CI verifies code, tests browsers, builds Windows, and retains a build artifact | Workflow prepared; remote CI execution requires committing and pushing it |
| Some controls/dialogs lacked useful accessible names or reduced-motion behavior | Named dialogs/help control, autosave status announcement, reduced-motion CSS | Source inspection; browser smoke tests. This is not a full accessibility audit |

## Delivery checks

Local result: syntax checks passed; all 7 unit tests and all 4 browser workflows
passed. The same 4 browser workflows also passed against the final standalone
executable with Node removed from PATH. The dependency audit reported 0 known
vulnerabilities. The Windows ZIP and executable were built locally; remote CI has
not run. The application changes and v1.1.0 Windows release have been published
to GitHub; automated verification remains local.

- `npm run check`: syntax checks for maintained source and verification scripts.
- `npm test`: schema and server behavior, including failure paths.
- `npm run test:browser`: live reflection, rigid grid recentering, fractional edits,
  labels, save/open, all export formats, safe import rejection, and autosave recovery.
- `npm run build:windows`: runtime checksum validation, embedded assets and notices.
- `npm run test:exe`: executable in an isolated directory with no Node executable
  on PATH, asset equality, restricted serving, and browser journeys.

The existing untracked `test-*.cjs` scripts and `test-output/` files were preserved.
They are local historical checks, not inputs to the maintained build or CI.

## Remaining decisions and limits

- The owner selected the MIT License. It is included in the repository and future
  Windows packages; the existing release receives a separate license asset.
- The executable is unsigned. Windows or managed devices may warn or require signing.
- Windows x64 is the supported build target. A separate clean Windows VM, ARM64,
  macOS packaging, and Linux packaging were not tested.
- GitHub Actions is not active. Publishing the prepared workflow requires GitHub
  authentication with workflow permission and a successful remote run.
- Browser drawing remains a visual interaction; the added labels and keyboard
  controls do not establish full assistive-technology accessibility.
- PDF export remains raster-based; SVG is the vector export format.

## Public-release follow-up

The four reachable commits (62 file versions) were scanned for common token,
private-key, personal-path, and known private-email patterns, with no matches.
Pattern matching cannot prove the absence of every possible secret. Git authors
use a GitHub no-reply email. Source control excludes downloaded runtimes, build
outputs, and personal diagram files.

The README now accurately describes local verification, MIT licensing, and
contribution instructions. Syntax checks and all seven unit tests passed again
after the license and packaging changes. The existing tested executable remains
unchanged; future builds copy the MIT license into their output folder.
