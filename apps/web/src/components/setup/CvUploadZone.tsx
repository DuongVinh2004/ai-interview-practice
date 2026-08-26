import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface CvUploadZoneProps {
  onParsed: (parsedData: any) => void;
  isParsing: boolean;
  onParseText: (text: string) => Promise<any>;
  onParseFile: (file: File) => Promise<any>;
}

export const CvUploadZone: React.FC<CvUploadZoneProps> = ({
  onParsed,
  isParsing,
  onParseText,
  onParseFile,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'upload' | 'text'>('upload');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
      setError('Supported formats: PDF, DOCX, TXT');
      return;
    }

    setError(null);
    setSelectedFile(file);
    try {
      const res = await onParseFile(file);
      onParsed(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to parse resume');
    }
  };

  const handleTextSubmit = async () => {
    if (rawText.trim().length < 10) {
      setError('Please enter at least 10 characters of CV text.');
      return;
    }
    setError(null);
    try {
      const res = await onParseText(rawText);
      onParsed(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to parse resume text');
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
      data-testid="cv-upload-zone"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-primary-600" />
          <h3 className="text-sm font-bold text-slate-800">
            1. Resume / CV Upload (Hồ sơ ứng viên)
          </h3>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`px-3 py-1 rounded-md transition-all ${
              inputMode === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            File Upload
          </button>
          <button
            type="button"
            onClick={() => setInputMode('text')}
            className={`px-3 py-1 rounded-md transition-all ${
              inputMode === 'text'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Paste Text
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {inputMode === 'upload' ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-primary-500 bg-primary-50/50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleChange}
            className="hidden"
          />

          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
              {isParsing ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : selectedFile ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB — Parsed successfully
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Kéo thả CV (PDF, DOCX, TXT) vào đây hoặc{' '}
                  <span className="text-primary-600 font-bold">Chọn tệp</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Tối đa 5MB • Tự động mã hóa & bảo vệ PII
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={5}
            placeholder="Dán nội dung tóm tắt kinh nghiệm, kỹ năng và các dự án trong CV của bạn vào đây..."
            className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleTextSubmit}
            isLoading={isParsing}
            disabled={isParsing || rawText.trim().length < 10}
          >
            Phân tích nội dung CV
          </Button>
        </div>
      )}
    </div>
  );
};
