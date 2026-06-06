import { defineConfig } from "vite"

export default defineConfig({
  root: "ui",
  publicDir: false,
  server: {
    host: "127.0.0.1",
    port: 4174
  },
  preview: {
    host: "127.0.0.1",
    port: 4175
  },
  build: {
    outDir: "../dist-ui",
    emptyOutDir: true,
    target: "es2022"
  }
})
