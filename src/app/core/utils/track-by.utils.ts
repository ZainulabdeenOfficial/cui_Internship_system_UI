/**
 * TrackBy Functions for NgFor Optimization
 * Prevents unnecessary DOM re-renders
 */

export const trackById = <T extends { id: any }>(index: number, item: T): any => {
  return item?.id ?? index;
};

export const trackByIndex = (index: number): number => {
  return index;
};

export const trackByProperty = <T>(property: keyof T) => {
  return (index: number, item: T): any => {
    return item?.[property] ?? index;
  };
};

export const trackByIdOrIndex = <T extends { id?: any }>(index: number, item: T): any => {
  return item?.id ?? item ?? index;
};

// Specialized track functions
export const trackByStudentId = trackByProperty<{ id: string }>('id');
export const trackByFormId = trackByProperty<{ id: string }>('id');
export const trackByCompanyId = trackByProperty<{ id: string }>('id');
