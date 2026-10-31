import { useEffect, useRef } from "react";
import { monaco } from "../monaco";

interface DiffEditorProps {
  oldValue: string;
  newValue: string;
  language: string;
  dark: boolean;
  emptyText?: string;
  renderSideBySide?: boolean;
}

export function DiffEditor({ oldValue, newValue, language, dark, emptyText, renderSideBySide = false }: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const originalRef = useRef<monaco.editor.ITextModel | null>(null);
  const modifiedRef = useRef<monaco.editor.ITextModel | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const original = monaco.editor.createModel(oldValue, language);
    const modified = monaco.editor.createModel(newValue, language);
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      automaticLayout: true,
      readOnly: true,
      renderSideBySide,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "off",
      renderWhitespace: "selection",
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 21,
      padding: { top: 12, bottom: 12 },
      ignoreTrimWhitespace: false,
      originalEditable: false,
    });
    editor.setModel({ original, modified });
    editorRef.current = editor;
    originalRef.current = original;
    modifiedRef.current = modified;
    monaco.editor.setTheme(dark ? "vs-dark" : "vs");
    return () => {
      editor.dispose();
      original.dispose();
      modified.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!originalRef.current || !modifiedRef.current) return;
    if (originalRef.current.getValue() !== oldValue) originalRef.current.setValue(oldValue);
    if (modifiedRef.current.getValue() !== newValue) modifiedRef.current.setValue(newValue);
    monaco.editor.setModelLanguage(originalRef.current, language);
    monaco.editor.setModelLanguage(modifiedRef.current, language);
  }, [oldValue, newValue, language]);

  useEffect(() => {
    editorRef.current?.updateOptions({ renderSideBySide });
  }, [renderSideBySide]);

  useEffect(() => {
    monaco.editor.setTheme(dark ? "vs-dark" : "vs");
  }, [dark]);

  return (
    <div className="diff-editor-shell">
      <div ref={containerRef} className="diff-editor" />
      {!oldValue && !newValue && emptyText ? <div className="diff-empty-hint">{emptyText}</div> : null}
    </div>
  );
}
