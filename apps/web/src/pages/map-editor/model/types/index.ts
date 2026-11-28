export enum EditorTabType {
  ADD = 'ADD',
  OBJECT = 'OBJECT',
  LIST = 'LIST',
  CHECK = 'CHECK',
}
export interface TabItem {
  value: EditorTabType;
  content: string;
}

export const isEditorTabType = (value: string): value is EditorTabType =>
  (Object.values(EditorTabType) as string[]).includes(value);
