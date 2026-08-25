import React, { useState } from 'react';
import { SupportedCodeLanguage } from '@ai-interview/contracts';
import { Play, Send, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface MonacoCodeEditorProps {
  language: SupportedCodeLanguage;
  initialCode?: string;
  onLanguageChange: (lang: SupportedCodeLanguage) => void;
  onCodeChange: (code: string) => void;
  onRunCode: (code: string, language: SupportedCodeLanguage) => void;
  onSubmitCode: (code: string, language: SupportedCodeLanguage) => void;
  isRunning?: boolean;
  isSubmitting?: boolean;
}

const DEFAULT_STARTER_TEMPLATES: Record<SupportedCodeLanguage, string> = {
  javascript: `// JavaScript Solution\nfunction solution(input) {\n  // Write your code here\n  return input;\n}`,
  typescript: `// TypeScript Solution\nfunction solution(input: any): any {\n  // Write your code here\n  return input;\n}`,
  python: `# Python Solution\ndef solution(input_data):\n    # Write your code here\n    return input_data`,
  java: `// Java Solution\nclass Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`,
  go: `// Go Solution\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
  cpp: `// C++ Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
};

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  language,
  initialCode,
  onLanguageChange,
  onCodeChange,
  onRunCode,
  onSubmitCode,
  isRunning = false,
  isSubmitting = false,
}) => {
  const [code, setCode] = useState(initialCode || DEFAULT_STARTER_TEMPLATES[language] || '');

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    onCodeChange(val);
  };

  const handleLanguageSelect = (newLang: SupportedCodeLanguage) => {
    onLanguageChange(newLang);
    const starter = DEFAULT_STARTER_TEMPLATES[newLang] || '';
    setCode(starter);
    onCodeChange(starter);
  };

  const handleReset = () => {
    const starter = DEFAULT_STARTER_TEMPLATES[language] || '';
    setCode(starter);
    onCodeChange(starter);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + '  ' + code.substring(end);
      setCode(updated);
      onCodeChange(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl"
      data-testid="code-editor-container"
    >
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <label
            htmlFor="language-select"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Language:
          </label>
          <select
            id="language-select"
            value={language}
            onChange={e => handleLanguageSelect(e.target.value as SupportedCodeLanguage)}
            className="bg-slate-700 text-slate-100 text-sm rounded px-2.5 py-1 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
            data-testid="language-selector"
          >
            <option value="javascript">JavaScript (Node.js)</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python 3</option>
            <option value="java">Java (OpenJDK)</option>
            <option value="go">Go</option>
            <option value="cpp">C++ (GCC)</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            title="Reset code template"
            className="text-xs text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRunCode(code, language)}
            disabled={isRunning || isSubmitting}
            className="bg-slate-700 hover:bg-slate-600 text-emerald-400 font-medium"
            data-testid="run-code-btn"
          >
            <Play className="w-3.5 h-3.5 mr-1 fill-current" />{' '}
            {isRunning ? 'Running...' : 'Run Code'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSubmitCode(code, language)}
            disabled={isRunning || isSubmitting}
            className="bg-primary-600 hover:bg-primary-500 text-white font-medium"
            data-testid="submit-code-btn"
          >
            <Send className="w-3.5 h-3.5 mr-1" />{' '}
            {isSubmitting ? 'Submitting...' : 'Submit Solution'}
          </Button>
        </div>
      </div>

      {/* Code Editor Text Area */}
      <div className="relative flex-1 bg-slate-950 font-mono text-sm">
        <textarea
          value={code}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full h-full p-4 bg-transparent text-slate-100 font-mono resize-none focus:outline-none leading-relaxed selection:bg-primary-900"
          placeholder="Type your code here..."
          data-testid="code-textarea"
        />
      </div>
    </div>
  );
};
