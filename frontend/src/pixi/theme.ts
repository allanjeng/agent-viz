export const OFFICE_PALETTE = {
  backgroundTop: 0x2f2018,
  backgroundBottom: 0x5f4333,
  floorA: 0x7b5a43,
  floorB: 0x8a684f,
  panelA: 0x4f3729,
  panelB: 0x634634,
  border: 0xb68660,
  text: 0xfff1df,
  muted: 0xe4c29f,
  nexus: 0xf2b26f,
  nexusBrass: 0xd18d4d,
  pivot: 0x9eb56a,
  pivotGold: 0xd7b16a,
  aegis: 0xe08579,
  aegisRed: 0xcd6a62,
  researcher: 0xc8ad8d,
  researcherPaper: 0xf4e0c5,
  contractor: 0xd89a66,
} as const;

export const PERSISTENT_THEMES: Record<string, { desk: number; accent: number; chair: number }> = {
  nexus: {
    desk: 0x744f39,
    accent: OFFICE_PALETTE.nexusBrass,
    chair: 0x5d4434,
  },
  pivot: {
    desk: 0x6d5842,
    accent: OFFICE_PALETTE.pivotGold,
    chair: 0x544334,
  },
  aegis: {
    desk: 0x7a4a44,
    accent: OFFICE_PALETTE.aegisRed,
    chair: 0x603a36,
  },
  researcher: {
    desk: 0x6f5846,
    accent: OFFICE_PALETTE.researcher,
    chair: 0x5a473a,
  },
};

export const CONTRACTOR_THEME = {
  desk: 0x7a5b43,
  accent: OFFICE_PALETTE.contractor,
  chair: 0x624a37,
};
