"use client";

type NotebookOutput = { text?: string[]; data?: Record<string, string | string[]> };
type NotebookCell = {
  cell_type?: string;
  source?: string[];
  outputs?: NotebookOutput[];
};

export default function NotebookViewer({ source }: { source: string }) {
  let cells: NotebookCell[] = [];
  try {
    const notebook = JSON.parse(source) as { cells?: NotebookCell[] };
    cells = notebook.cells || [];
  } catch {
    return <div className="reader-unsupported">Notebook không hợp lệ hoặc đã bị hỏng.</div>;
  }

  const outputText = (output: NotebookOutput) => {
    const value = output.text || output.data?.['text/plain'] || [];
    return Array.isArray(value) ? value.join('') : value;
  };

  return (
    <div className="notebook-viewer">
      {cells.map((cell, index) => (
        <article key={index} className={`notebook-cell ${cell.cell_type || 'raw'}`}>
          <span>{cell.cell_type === 'code' ? `In [${index + 1}]` : 'Markdown'}</span>
          <pre>{(cell.source || []).join('')}</pre>
          {cell.cell_type === 'code' && cell.outputs?.map((output, outputIndex) => (
            <pre className="notebook-output" key={outputIndex}>
              {outputText(output)}
            </pre>
          ))}
        </article>
      ))}
    </div>
  );
}
