import React, { useState, useRef } from 'react';
import { Agent } from 'stanza';

interface Props {
  client: Agent;
  onUploadSuccess?: (url: string) => void;
}

export default function FileUpload({ client, onUploadSuccess }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAction = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setIsUploading(true);
    try {
      // 1. Ask Prosody for an upload slot
      // Ensure 'upload.localhost' matches your prosody.cfg.lua Component
      const slot = await client.getUploadSlot('upload.localhost', {
        name: file.name,
        size: file.size,
        contentType: file.type || 'application/octet-stream'
      });

      // 2. Perform the actual HTTP PUT upload
      const response = await fetch(slot.put!, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      if (response.ok) {
        console.log("Upload successful:", slot.get);
        onUploadSuccess?.(slot.get!);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload file. Check if Prosody mod_http_file_share is active.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileAction}
        className="hidden"
        id="xmpp-upload"
      />
      <label
        htmlFor="xmpp-upload"
        className={`px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors
          ${isUploading ? 'bg-gray-400 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
      >
        {isUploading ? 'Uploading...' : '📎 Share File'}
      </label>
      {isUploading && <span className="text-xs text-gray-500 animate-pulse">Processing...</span>}
    </div>
  );
}
