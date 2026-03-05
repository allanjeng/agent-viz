export const OFFICE_PALETTE = {
  backgroundTop: 0x3a241a,
  backgroundBottom: 0x5a3a2a,
  panelA: 0x4a2f22,
  panelB: 0x6b4a37,
  floorA: 0xc8a27f,
  floorB: 0xb88f6a,
  wall: 0x8b6348,
  wallTrim: 0x9a7459,
  border: 0x9a7459,
  text: 0xf8e8d8,
  muted: 0xe4c3a8,
  nexus: 0xf6ad55,
  nexusBrass: 0xe39e52,
  pivot: 0x9bbf5f,
  pivotGold: 0xb2c673,
  aegis: 0xe57373,
  aegisRed: 0xd96565,
  researcher: 0xc5a3ff,
  researcherPaper: 0xd7beff,
  contractor: 0xd9a066,
} as const;

export const PERSISTENT_THEMES: Record<string, { desk: number; accent: number; chair: number }> = {
  nexus: {
    desk: 0x8a654b,
    accent: OFFICE_PALETTE.nexusBrass,
    chair: 0x6f523d,
  },
  pivot: {
    desk: 0x7c654e,
    accent: OFFICE_PALETTE.pivotGold,
    chair: 0x695542,
  },
  aegis: {
    desk: 0x8a5a55,
    accent: OFFICE_PALETTE.aegisRed,
    chair: 0x744946,
  },
  researcher: {
    desk: 0x7c6959,
    accent: OFFICE_PALETTE.researcher,
    chair: 0x675748,
  },
};

export const CONTRACTOR_THEME = {
  desk: 0x89684f,
  accent: OFFICE_PALETTE.contractor,
  chair: 0x705742,
};
