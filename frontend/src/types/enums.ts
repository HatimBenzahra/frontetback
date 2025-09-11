// frontend-shadcn/src/types/enums.ts

export enum AssignmentType {
  EQUIPE = 'EQUIPE',
  MANAGER = 'MANAGER',
  COMMERCIAL = 'COMMERCIAL',
}

export enum PorteStatus {
  NON_VISITE = 'NON_VISITE',
  VISITE = 'VISITE',
  ABSENT = 'ABSENT',
  REFUS = 'REFUS',
  CURIEUX = 'CURIEUX',
  CONTRAT_SIGNE = 'CONTRAT_SIGNE',
}

export enum ProspectingMode {
  SOLO = 'SOLO',
  DUO = 'DUO',
}

// AJOUT DE L'ENUM MANQUANT
export enum PeriodType {
  WEEKLY,
  MONTHLY,
  YEARLY,
}