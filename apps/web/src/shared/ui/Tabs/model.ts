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
