export const OFFICE_PALETTE = {
  backgroundTop: 0x3a2b22,
  backgroundBottom: 0x5f4638,
  floorA: 0x6d5240,
  floorB: 0x7a5d48,
  panelA: 0x4a362a,
  panelB: 0x5a4132,
  border: 0x9d7656,
  text: 0xfff1dd,
  muted: 0xd9b798,
  nexus: 0xf1a65d,
  nexusBrass: 0xc8823e,
  pivot: 0x84a957,
  pivotGold: 0xd3ab55,
  aegis: 0xd96868,
  aegisRed: 0xc84f4f,
  researcher: 0xb593db,
  researcherPaper: 0xf0dcc2,
  contractor: 0xcd8a53,
} as const;

export const PERSISTENT_THEMES: Record<string, { desk: number; accent: number; chair: number }> = {
  nexus: {
    desk: 0x6f4f3b,
    accent: OFFICE_PALETTE.nexusBrass,
    chair: 0x5a4131,
  },
  pivot: {
    desk: 0x62523e,
    accent: OFFICE_PALETTE.pivotGold,
    chair: 0x4e3f30,
  },
  aegis: {
    desk: 0x704546,
    accent: OFFICE_PALETTE.aegisRed,
    chair: 0x563233,
  },
  researcher: {
    desk: 0x644f67,
    accent: OFFICE_PALETTE.researcher,
    chair: 0x4f3d52,
  },
};

export const CONTRACTOR_THEME = {
  desk: 0x705542,
  accent: OFFICE_PALETTE.contractor,
  chair: 0x564131,
};
