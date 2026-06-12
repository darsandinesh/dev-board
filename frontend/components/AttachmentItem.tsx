"use client";

import { Download, Paperclip, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { attachmentBlobUrl, downloadAttachment, type Attachment } from "@/lib/api";

export function AttachmentItem({
  taskId,
  att,
  canDelete,
  onDelete,
  onPreview,
}: {
  taskId: string;
  att: Attachment;
  canDelete: boolean;
  onDelete: () => void;
  onPreview: (url: string) => void;
}) {
  const isImage = att.content_type.startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let url: string;
    let alive = true;
    attachmentBlobUrl(taskId, att.id).then((u) => {
      url = u;
      if (alive) setThumb(u);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [taskId, att.id, isImage]);

  return (
    <li className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      {isImage && thumb ? (
        <button onClick={() => onPreview(thumb)} className="shrink-0">
          <img src={thumb} alt={att.filename} className="h-10 w-10 rounded object-cover" />
        </button>
      ) : (
        <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
      )}
      <span className="flex-1 truncate text-slate-700">{att.filename}</span>
      <span className="text-xs text-slate-400">{Math.ceil(att.size / 1024)} KB</span>
      <button
        onClick={() => downloadAttachment(taskId, att)}
        className="text-slate-400 hover:text-indigo-600"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </button>
      {canDelete && (
        <button
          onClick={onDelete}
          className="text-slate-300 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
