#!/usr/bin/env node

const { build, cliopts } = require("estrella");

build({
  entry: "src/index.tsx",
  outfile: "build/app.js",
  bundle: true,
  sourcemap: "inline",
  keepNames: true,
  debug: true,
  format: "iife",
  platform: "browser",
  external: ["path", "crypto", "fs"],
  define: {
    "process.env.NODE_ENV": '"development"',
    global: "window",
  },
});

cliopts.watch &&
  require("serve-http").createServer({
    port: 3000,
    pubdir: ".",
    indexFilename: "index-estrella.html",
  });
