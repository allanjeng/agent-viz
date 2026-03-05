export const OFFICE_PALETTE = {
  backgroundTop: 0xc7a486,
  backgroundBottom: 0xb98f69,
  panelA: 0xc6a07d,
  panelB: 0xb88f69,
  floorA: 0xf0dcc4,
  floorB: 0xe5c9a7,
  floorLine: 0xd0ad88,
  wall: 0xd5ae8a,
  wallTrim: 0xbd8d65,
  border: 0xb88661,
  text: 0xfff3e6,
  muted: 0xeed7be,
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
    desk: 0xb08664,
    accent: OFFICE_PALETTE.nexusBrass,
    chair: 0x926f53,
  },
  pivot: {
    desk: 0xa38665,
    accent: OFFICE_PALETTE.pivotGold,
    chair: 0x8a7053,
  },
  aegis: {
    desk: 0xaf7e74,
    accent: OFFICE_PALETTE.aegisRed,
    chair: 0x94635a,
  },
  researcher: {
    desk: 0x9e896f,
    accent: OFFICE_PALETTE.researcher,
    chair: 0x84715c,
  },
};

export const CONTRACTOR_THEME = {
  desk: 0xaf8866,
  accent: OFFICE_PALETTE.contractor,
  chair: 0x8d7055,
};
