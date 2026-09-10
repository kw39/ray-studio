# Contributing to Ray Studio

Use GitHub Issues for reproducible bugs and feature proposals. Include your app
version, operating system, browser, steps to reproduce, and expected and actual
results. For drawing problems, attach a minimal project or screenshot with no
student names or other personal information. Discuss large changes before starting.

For code changes, fork the repository, create a branch, and open a pull request
describing the problem, the change, and how you checked it. Contributions are
provided under the repository's MIT License. Submit only work you have permission
to contribute.

Follow the setup commands in the README. Before submitting, run `npm run check`,
`npm test`, and `npm run test:browser`. For packaging or server changes, also run
`npm run build:windows` and `npm run test:exe` on Windows x64. Add regression tests
for behavior changes; documentation-only changes do not need new tests.

Keep changes focused and follow the existing vanilla JavaScript and SVG structure.
Do not commit downloaded runtimes, executables, node_modules, local test output,
credentials, or personal diagram files. Release downloads belong in GitHub Releases.
