// Nguồn: base-frontend-web/src/mocks/activity.ts

export interface SeedActivity {
  kind: "join" | "register" | "invite" | "result";
  actorUsername: string;
  roomCode: string | null;
  tournamentSlug: string | null;
  text: string;
  emphasis: string | null;
  createdAt: string;
  recipientUsernames: string[];
}

export const SEED_ACTIVITIES: SeedActivity[] = [
  {
    kind: "join",
    actorUsername: "suthy",
    roomCode: null,
    tournamentSlug: null,
    text: 'Tham gia phòng "Giao lưu cộng đồng #06"',
    emphasis: null,
    createdAt: "2026-11-15T19:55:00+07:00",
    recipientUsernames: ["suthy"],
  },
  {
    kind: "register",
    actorUsername: "suthy",
    roomCode: null,
    tournamentSlug: "custom-league-3",
    text: 'Theo dõi giải "Custom League #3"',
    emphasis: null,
    createdAt: "2026-11-15T19:42:00+07:00",
    recipientUsernames: ["suthy"],
  },
  {
    kind: "invite",
    actorUsername: "hieukm",
    roomCode: "AOV-1024",
    tournamentSlug: null,
    text: 'Được mời vào phòng "Kèo giao hữu – Team A vs B"',
    emphasis: null,
    createdAt: "2026-11-15T19:28:00+07:00",
    recipientUsernames: ["suthy"],
  },
  {
    kind: "result",
    actorUsername: "suthy",
    roomCode: null,
    tournamentSlug: null,
    text: "Trận đấu đã kết thúc",
    emphasis: "Thắng",
    createdAt: "2026-11-15T19:15:00+07:00",
    recipientUsernames: ["suthy"],
  },
];
