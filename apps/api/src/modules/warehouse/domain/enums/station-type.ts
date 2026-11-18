export const StationType = {
  Receiving: 'receiving',
  Issuing: 'issuing',
  Intermediate: 'intermediate',
} as const;

export type StationType = (typeof StationType)[keyof typeof StationType];
