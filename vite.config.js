import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pagesはサブフォルダ配信のため、相対パスにしておくとリポジトリ名に関わらず動く
  base: "./",
});
