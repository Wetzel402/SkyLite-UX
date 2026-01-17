---
title: Documentation
parent: Contributing
layout: default
nav_order: 10
permalink: /contributing/documentation/
---

# Documentation

The documentation site for Skylite UX is built with Jekyll and hosted on GitHub Pages. This section covers how to test and work with the documentation locally using the dev container.

## Running the Local Server

Start the Jekyll development server using the npm script:

```bash
npm run docs
```

Alternatively, you can run the command directly from the `docs/` directory:

```bash
cd docs && bundle exec jekyll serve --host 0.0.0.0
```

The `--host 0.0.0.0` flag is important in the dev container so that the server is accessible from outside the container. The documentation site will be available at `http://localhost:4000/SkyLite-UX/` (port forwarding should be configured automatically). Jekyll will automatically regenerate the site when you make changes to Markdown files.

## Making Changes

1. Edit any `.md` file in the `docs/` directory
2. Save your changes
3. The site will automatically rebuild (watch for changes in the terminal)
4. Refresh your browser to see the updates

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running to stop it.
