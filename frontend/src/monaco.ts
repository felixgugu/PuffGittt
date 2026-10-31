import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/language/json/json.worker?worker";
import cssWorker from "monaco-editor/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/language/html/html.worker?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import "../node_modules/monaco-editor/min/vs/editor/editor.main.css";

(self as any).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

monaco.editor.defineTheme("puff-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#fffdfa",
    "editor.lineHighlightBackground": "#f2efe8",
    "editorLineNumber.foreground": "#a9a49a",
    "editorGutter.background": "#fffdfa",
    "diffEditor.insertedLineBackground": "#e4f1e8",
    "diffEditor.removedLineBackground": "#f6e6e1",
    "diffEditor.insertedTextBackground": "#b9dcc4",
    "diffEditor.removedTextBackground": "#efc4b8",
    "diffEditor.border": "#e0dcd3",
    "scrollbarSlider.background": "#315d5522",
    "scrollbarSlider.hoverBackground": "#315d5533",
  },
});

monaco.editor.defineTheme("puff-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#1e201d",
    "editor.lineHighlightBackground": "#242621",
    "editorLineNumber.foreground": "#6d6a63",
    "editorGutter.background": "#1e201d",
    "diffEditor.insertedLineBackground": "#1d2c25",
    "diffEditor.removedLineBackground": "#2d211e",
    "diffEditor.insertedTextBackground": "#2f5747",
    "diffEditor.removedTextBackground": "#5a3730",
    "diffEditor.border": "#2c2e29",
    "scrollbarSlider.background": "#8bc7b822",
    "scrollbarSlider.hoverBackground": "#8bc7b833",
  },
});

export const monacoTheme = (dark: boolean) => (dark ? "puff-dark" : "puff-light");

export { monaco };
