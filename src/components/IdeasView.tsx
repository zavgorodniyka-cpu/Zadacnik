"use client";

import { useEffect, useMemo, useState } from "react";
import type { Folder, IdeaItem } from "@/types/folder";
import { extractDomain } from "@/lib/folders";

type Props = {
  folders: Folder[];
  items: IdeaItem[];
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
    <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
                <button
                  type="button"
                  onClick={() => onSelect(f.id)}
                  onDoubleClick={() => setEditingId(f.id)}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(f.id);
                    }}
                    aria-label="Редактировать папку"
                    className="rounded p-0.5 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 2l3 3-9 9H2v-3z" />
                    </svg>
                  </button>
                </button>
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
  onAdd,
  onUpdate,
  onDelete,
  generateId,
}: {
  folder: Folder | null;
  items: IdeaItem[];
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
          Пусто. Добавь первую идею или ссылку.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) =>
            editingId === item.id ? (
              <ItemEditRow
                key={item.id}
                item={item}
                onSave={(patch) => {
                  onUpdate(item.id, patch);
                  setEditingId(null);
                }}
                onDelete={() => {
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
  onSubmit,
  onCancel,
  generateId,
}: {
  folderId: string;
  onSubmit: (item: IdeaItem) => void;
  onCancel: () => void;
  generateId: () => string;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

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
      createdAt: new Date().toISOString(),
    });
    setTitle("");
    setUrl("");
    setNotes("");
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900">
      <span className="mt-0.5 flex-none text-base">
        {item.url ? "🔗" : "📝"}
      </span>
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

function ItemEditRow({
  item,
  onSave,
  onDelete,
  onCancel,
}: {
  item: IdeaItem;
  onSave: (patch: Partial<IdeaItem>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
    });
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!title.trim()}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Удалить
        </button>
      </div>
    </li>
  );
}
