export type Folder = {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
};

export type IdeaItem = {
  id: string;
  folderId: string;
  title: string;
  url?: string;
  notes?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  createdAt: string;
};
