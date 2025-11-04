'use client';

import React, { useState } from 'react';
import { Transition } from '@headlessui/react';

export interface IngestStory {
  content: string;
  metadata: Record<string, any>;
}

interface UploadStatus {
  type: 'success' | 'error' | null;
  message: string | null;
}

/**
 * CSVIngestControl
 * - Lets user pick a CSV file in the browser
 * - Parses it into stories and POSTs to /api/ingest
 * - Lightweight parser that handles quoted fields and simple CSVs
 */
export default function CSVIngestControl() {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [storiesPayload, setStoriesPayload] = useState<IngestStory[] | null>(null);
  const [status, setStatus] = useState<UploadStatus>({ type: null, message: null });

  const splitRow = (row: string) => {
    // Split on commas not inside quotes
    const re = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
    return row.split(re).map((c) => c.replace(/^\"|\"$/g, '').trim());
  };

  const parseCSV = (text: string): IngestStory[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return [];
    const header = splitRow(lines[0]).map((h) => h.toLowerCase());
    const rows = lines.slice(1).map((l) => {
      const cols = splitRow(l);
      const obj: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) {
        obj[header[i]] = cols[i] ?? '';
      }
      return obj;
    });

    const stories: IngestStory[] = rows
      .map((r) => {
        const content = (r.content || r.story || r.text || '').trim();
        const metadata: Record<string, any> = {};
        if (r.description) metadata.description = r.description;
        if (r.acceptancecriteria) {
          const ac = r.acceptancecriteria;
          try {
            const parsed = JSON.parse(ac);
            metadata.acceptanceCriteria = Array.isArray(parsed) ? parsed : [String(parsed)];
          } catch (e) {
            metadata.acceptanceCriteria = ac.split(';').map((s: string) => s.trim()).filter(Boolean);
          }
        }
        if (r.epic) metadata.epic = r.epic;
        if (r.sprint) metadata.sprint = r.sprint;
        if (r.points) metadata.points = Number(r.points);
        if (r.priority) metadata.priority = r.priority;
        if (r.status) metadata.status = r.status;
        if (r.assignee) metadata.assignee = r.assignee;
        if (r.createddate) metadata.createdDate = r.createddate;
        return { content, metadata };
      })
      .filter((s) => s.content && s.content.length > 0);

    return stories;
  };

  const handleFile = (file: File | null) => {
    setStatus({ type: null, message: null });
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus({ type: 'error', message: 'Please select a CSV file.' });
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      const stories = parseCSV(text);
      setParsedCount(stories.length);
      setStoriesPayload(stories);
      
      if (stories.length === 0) {
        setStatus({ 
          type: 'error', 
          message: 'No valid stories found in the CSV. Please ensure your file has a content, story, or text column.' 
        });
      }
    };
    reader.onerror = () => {
      setStatus({ 
        type: 'error', 
        message: 'Error reading file. Please try again.' 
      });
    };
    reader.readAsText(file);
  };

  const upload = async () => {
    setStatus({ type: null, message: null });
    
    if (!storiesPayload || storiesPayload.length === 0) {
      setStatus({ type: 'error', message: 'No stories found in the selected file. Please ensure your CSV file has a content, story, or text column.' });
      return;
    }
    
    try {
      setIsUploading(true);
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stories: storiesPayload })
      });
      const result = await response.json();
      console.log('Ingest response:', result);
      
      if (result.ok) {
        setStatus({ 
          type: 'success', 
          message: `Successfully ingested ${result.count} stories! You can now use the RAG Pipeline Search to find similar stories.` 
        });
      } else {
        setStatus({ 
          type: 'error', 
          message: result.message || 'Failed to ingest stories. Please try again.' 
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setStatus({ 
        type: 'error', 
        message: 'Upload failed. Please check your connection and try again.' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4">
        <label className="flex items-center justify-between p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer bg-gray-50">
          <span className="text-sm font-medium text-gray-700">
            {fileName ? `Selected: ${fileName}` : 'Click here to select a CSV file'}
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)}
            className="hidden"
          />
          <span className="text-sm text-indigo-600 font-medium">Browse</span>
        </label>

        {parsedCount !== null && (
          <div className="text-sm text-gray-600 pl-2">
            Found {parsedCount} stories in file
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={upload}
          disabled={isUploading || !fileName}
          className="inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isUploading ? 'Uploading...' : 'Upload & Ingest'}
        </button>
      </div>

      <Transition
        show={status.type !== null}
        enter="transition-opacity duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className={`mt-4 p-4 rounded-md ${
          status.type === 'success' ? 'bg-green-50 border border-green-200' : 
          status.type === 'error' ? 'bg-red-50 border border-red-200' : ''
        }`}>
          <p className={`text-sm ${
            status.type === 'success' ? 'text-green-800' : 
            status.type === 'error' ? 'text-red-800' : ''
          }`}>
            {status.message}
          </p>
        </div>
      </Transition>
    </div>
  );
}
