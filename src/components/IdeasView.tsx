"use client";

import { useEffect, useMemo, useState } from "react";
import type { Folder, IdeaItem } from "@/types/folder";
import { extractDomain } from "@/lib/folders";
import {
  deleteIdeaFile,
  formatBytes,
  getIdeaFileUrl,
  isImage,
  isPdf,
  uploadIdeaFile,
  type UploadedFile,
} from "@/lib/db/storage";

type Props = {
  folders: Folder[];
  items: IdeaItem[];
  userId: string;
  onAddFolder: (folder: Folder) => void;
  onUpdateFolder: (id: string, patch: Partial<Folder>) => void;
  onDeleteFolder: (id: string) => void;
  onAddItem: (item: IdeaItem) => void;
  onUpdateItem: (id: string, patch: Partial<IdeaItem>) => void;
  onDeleteItem: (id: string) => void;
  generateId: () => string;
};

const FOLDER_EMOJI_PRESETS = ["📁", "🏠", "🧖", "💼", "👪", "📚", "🚗", "✈️", "🍳", "🎨"];

export default function IdeasView({
  folders,
  items,
  userId,
  onAddFolder,
  onUpdateFolder,
  onDeleteFolder,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  generateId,
}: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    folders[0]?.id ?? null,
  );

  useEffect(() => {
    if (folders.length === 0) {
      setSelectedFolderId(null);
    } else if (
      !selectedFolderId ||
      !folders.find((f) => f.id === selectedFolderId)
    ) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) map.set(i.folderId, (map.get(i.folderId) ?? 0) + 1);
    return map;
  }, [items]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const folderItems = useMemo(
    () =>
      [...items]
        .filter((i) => i.folderId === selectedFolderId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items, selectedFolderId],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
      <FolderSidebar
        folders={folders}
        counts={counts}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        onAdd={(f) => {
          onAddFolder(f);
          setSelectedFolderId(f.id);
        }}
        onUpdate={onUpdateFolder}
        onDelete={onDeleteFolder}
        generateId={generateId}
      />

      <ItemsPanel
        folder={selectedFolder}
        items={folderItems}
        userId={userId}
        onAdd={onAddItem}
        onUpdate={onUpdateItem}
        onDelete={onDeleteItem}
        generateId={generateId}
      />
    </div>
  );
}

function FolderSidebar({
  folders,
  counts,
  selectedFolderId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  generateId,
}: {
  folders: Folder[];
  counts: Map<string, number>;
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
  onAdd: (folder: Folder) => void;
  onUpdate: (id: string, patch: Partial<Folder>) => void;
  onDelete: (id: string) => void;
  generateId: () => string;
}) {
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("📁");
  const [editingId, setEditingId] = useState<string | null>(null);

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const folder: Folder = {
      id: generateId(),
      name: trimmed,
      emoji: draftEmoji.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onAdd(folder);
    setDraftName("");
    setDraftEmoji("📁");
    setAdding(false);
  }

  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          📂 Папки
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Добавить папку"
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={submitNew} className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftEmoji}
              onChange={(e) => setDraftEmoji(e.target.value.slice(0, 4))}
              className="w-10 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-center text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-50"
            />
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Название"
              autoFocus
              className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {FOLDER_EMOJI_PRESETS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setDraftEmoji(e)}
                className={[
                  "rounded px-1 text-base transition hover:bg-zinc-200 dark:hover:bg-zinc-800",
                  draftEmoji === e ? "bg-zinc-200 dark:bg-zinc-800" : "",
                ].join(" ")}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <button
              type="submit"
              disabled={!draftName.trim()}
              className="flex-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraftName("");
              }}
              className="rounded-md px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              ×
            </button>
          </div>
        </form>
      )}

      {folders.length === 0 ? (
        <p className="px-1 py-2 text-xs text-zinc-500 dark:text-zinc-400">
          Нет папок. Создай первую.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {folders.map((f) => (
            <li key={f.id}>
              {editingId === f.id ? (
                <FolderEditRow
                  folder={f}
                  onSave={(patch) => {
                    onUpdate(f.id, patch);
                    setEditingId(null);
                  }}
                  onDelete={() => {
                    if (confirm(`Удалить папку «${f.name}» и все её записи?`)) {
                      onDelete(f.id);
                      setEditingId(null);
                    }
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(f.id)}
                    onDoubleClick={() => setEditingId(f.id)}
                    className={[
                      "flex w-full items-center gap-2 rounded-lg py-1.5 pl-2 pr-9 text-left transition",
                      selectedFolderId === f.id
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900",
                    ].join(" ")}
                  >
                    <span className="flex-none text-base">{f.emoji ?? "📁"}</span>
                    <span className="flex-1 truncate text-sm">{f.name}</span>
                    <span className="flex-none text-[11px] text-zinc-400 dark:text-zinc-600">
                      {counts.get(f.id) ?? 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(f.id)}
                    aria-label="Редактировать папку"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 2l3 3-9 9H2v-3z" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function FolderEditRow({
  folder,
  onSave,
  onDelete,
  onCancel,
}: {
  folder: Folder;
  onSave: (patch: Partial<Folder>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [emoji, setEmoji] = useState(folder.emoji ?? "");

  function save() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), emoji: emoji.trim() || undefined });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
          className="w-10 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-center text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-50"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </div>
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={save}
          disabled={!name.trim()}
          className="flex-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          OK
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          ×
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

function ItemsPanel({
  folder,
  items,
  userId,
  onAdd,
  onUpdate,
  onDelete,
  generateId,
}: {
  folder: Folder | null;
  items: IdeaItem[];
  userId: string;
  onAdd: (item: IdeaItem) => void;
  onUpdate: (id: string, patch: Partial<IdeaItem>) => void;
  onDelete: (id: string) => void;
  generateId: () => string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!folder) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Создай папку слева, чтобы начать собирать идеи.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          <span className="text-xl">{folder.emoji ?? "📁"}</span>
          <span>{folder.name}</span>
          <span className="text-xs font-normal text-zinc-400 dark:text-zinc-600">
            {items.length}
          </span>
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Добавить
          </button>
        )}
      </div>

      {adding && (
        <NewItemForm
          folderId={folder.id}
          userId={userId}
          onSubmit={(item) => {
            onAdd(item);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
          generateId={generateId}
        />
      )}

      {items.length === 0 && !adding ? (
        <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
          Пусто. Добавь первую идею, ссылку или файл.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) =>
            editingId === item.id ? (
              <ItemEditRow
                key={item.id}
                item={item}
                userId={userId}
                onSave={(patch) => {
                  onUpdate(item.id, patch);
                  setEditingId(null);
                }}
                onDelete={() => {
                  if (item.filePath) {
                    deleteIdeaFile(item.filePath).catch(() => {});
                  }
                  onDelete(item.id);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ItemDisplay
                key={item.id}
                item={item}
                onEdit={() => setEditingId(item.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function NewItemForm({
  folderId,
  userId,
  onSubmit,
  onCancel,
  generateId,
}: {
  folderId: string;
  userId: string;
  onSubmit: (item: IdeaItem) => void;
  onCancel: () => void;
  generateId: () => string;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    setUploadError(null);
    try {
      if (file) await deleteIdeaFile(file.path).catch(() => {});
      const uploaded = await uploadIdeaFile(f, userId);
      setFile(uploaded);
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!file) return;
    await deleteIdeaFile(file.path).catch(() => {});
    setFile(null);
  }

  async function handleCancel() {
    if (file) await deleteIdeaFile(file.path).catch(() => {});
    onCancel();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      id: generateId(),
      folderId,
      title: trimmed,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      filePath: file?.path,
      fileName: file?.name,
      fileSize: file?.size,
      fileMimeType: file?.mimeType,
      createdAt: new Date().toISOString(),
    });
    setTitle("");
    setUrl("");
    setNotes("");
    setFile(null);
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название"
        autoFocus
        className="mb-2 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https:// (необязательно)"
        className="mb-2 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Заметка (необязательно)"
        rows={2}
        className="mb-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />

      <FileAttachField
        file={file}
        uploading={uploading}
        error={uploadError}
        onChange={handleFileChange}
        onRemove={removeFile}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={!title.trim() || uploading}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={uploading}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function ItemDisplay({
  item,
  onEdit,
}: {
  item: IdeaItem;
  onEdit: () => void;
}) {
  const domain = item.url ? extractDomain(item.url) : null;
  const hasFile = !!item.filePath;
  const hasImage = hasFile && isImage(item.fileMimeType);

  let icon = "📝";
  if (item.url && !hasFile) icon = "🔗";
  else if (hasFile) {
    if (hasImage) icon = "🖼️";
    else if (isPdf(item.fileMimeType)) icon = "📄";
    else icon = "📎";
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900">
      <span className="mt-0.5 flex-none text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {item.url ? (
            <a
              href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-zinc-900 transition hover:underline dark:text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            >
              {item.title}
            </a>
          ) : (
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {item.title}
            </span>
          )}
          {domain && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
              {domain}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
            {item.notes}
          </p>
        )}
        {hasFile && item.filePath && (
          <FilePreview
            path={item.filePath}
            name={item.fileName ?? "файл"}
            size={item.fileSize ?? 0}
            mimeType={item.fileMimeType}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Редактировать"
        className="flex-none rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 2l3 3-9 9H2v-3z" />
        </svg>
      </button>
    </li>
  );
}

function FileAttachField({
  file,
  uploading,
  error,
  onChange,
  onRemove,
}: {
  file: UploadedFile | null;
  uploading: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950">
          <span className="flex-none">📎</span>
          <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
            {file.name}
          </span>
          <span className="flex-none text-zinc-400 dark:text-zinc-600">
            {formatBytes(file.size)}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Убрать файл"
            className="flex-none rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      ) : (
        <label
          className={[
            "flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-500 dark:hover:bg-zinc-900",
            uploading ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v8M4 7l4-4 4 4M3 13h10" />
          </svg>
          <span className="text-zinc-700 dark:text-zinc-300">
            {uploading ? "Загружаю…" : "Прикрепить файл"}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={onChange}
            disabled={uploading}
          />
        </label>
      )}
      {error && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function FilePreview({
  path,
  name,
  size,
  mimeType,
}: {
  path: string;
  name: string;
  size: number;
  mimeType: string | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getIdeaFileUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (isImage(mimeType)) {
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!url) e.preventDefault();
          e.stopPropagation();
        }}
        className="mt-2 block w-fit overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
      >
        {url ? (
          <img
            src={url}
            alt={name}
            className="block max-h-48 max-w-xs object-cover"
          />
        ) : (
          <div className="flex h-24 w-40 items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
            Загрузка…
          </div>
        )}
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!url) e.preventDefault();
        e.stopPropagation();
      }}
      className="mt-2 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      <span>{isPdf(mimeType) ? "📄" : "📎"}</span>
      <span className="max-w-[14rem] truncate">{name}</span>
      <span className="text-zinc-400 dark:text-zinc-600">·</span>
      <span className="text-zinc-400 dark:text-zinc-600">{formatBytes(size)}</span>
    </a>
  );
}

function ItemEditRow({
  item,
  userId,
  onSave,
  onDelete,
  onCancel,
}: {
  item: IdeaItem;
  userId: string;
  onSave: (patch: Partial<IdeaItem>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [file, setFile] = useState<UploadedFile | null>(
    item.filePath
      ? {
          path: item.filePath,
          name: item.fileName ?? "файл",
          size: item.fileSize ?? 0,
          mimeType: item.fileMimeType ?? "application/octet-stream",
        }
      : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [originalPath] = useState<string | undefined>(item.filePath);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    setUploadError(null);
    try {
      // If a NEW file was uploaded earlier in this session, drop it before re-uploading.
      if (file && file.path !== originalPath) {
        await deleteIdeaFile(file.path).catch(() => {});
      }
      const uploaded = await uploadIdeaFile(f, userId);
      setFile(uploaded);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!file) return;
    if (file.path !== originalPath) {
      // Newly uploaded but not yet saved — actually delete from storage.
      await deleteIdeaFile(file.path).catch(() => {});
    }
    setFile(null);
  }

  async function handleSave() {
    if (!title.trim()) return;
    // If user replaced the original file with a different one, delete the old one.
    if (originalPath && file?.path !== originalPath) {
      await deleteIdeaFile(originalPath).catch(() => {});
    }
    onSave({
      title: title.trim(),
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      filePath: file?.path,
      fileName: file?.name,
      fileSize: file?.size,
      fileMimeType: file?.mimeType,
    });
  }

  async function handleCancel() {
    // If user uploaded a new file but cancels, drop the orphan.
    if (file && file.path !== originalPath) {
      await deleteIdeaFile(file.path).catch(() => {});
    }
    onCancel();
  }

  return (
    <li className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="mb-2 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://"
        className="mb-2 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Заметка"
        rows={2}
        className="mb-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />

      <FileAttachField
        file={file}
        uploading={uploading}
        error={uploadError}
        onChange={handleFileChange}
        onRemove={removeFile}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || uploading}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={uploading}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={uploading}
          className="ml-auto rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Удалить
        </button>
      </div>
    </li>
  );
}
