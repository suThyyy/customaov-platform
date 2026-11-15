// Nguồn: base-frontend-web/src/mocks/rooms.ts

import type { RoomConfigJson } from "../schema.js";

export interface SeedRoomMember {
  username: string;
  side: "blue" | "red";
  lane: "TOP" | "JG" | "MID" | "AD" | "SP";
  ready: boolean;
  captain: boolean;
}

export interface SeedRoomMessage {
  authorUsername: string | null;
  text: string;
  system: boolean;
  createdAt: string;
}

export interface SeedRoom {
  code: string;
  title: string;
  highlight: string | null;
  thumbnail: string;
  hostUsername: string;
  mode: "normal" | "tournament" | "friendly" | "other";
  visibility: "public" | "private";
  capacity: number;
  status: "waiting" | "live" | "finished";
  config: RoomConfigJson;
  members: SeedRoomMember[];
  messages: SeedRoomMessage[];
}

const DEFAULT_CONFIG: RoomConfigJson = {
  format: "5v5",
  pickMode: "draft",
  series: "BO1",
  tools: ["balance", "lane", "chat"],
  notes: "",
};

const fullBlue: SeedRoomMember[] = [
  { username: "suthy", side: "blue", lane: "MID", ready: true, captain: true },
  { username: "vanhh", side: "blue", lane: "SP", ready: true, captain: false },
  { username: "minz", side: "blue", lane: "JG", ready: true, captain: false },
  { username: "khoaneo", side: "blue", lane: "AD", ready: true, captain: false },
  { username: "tine", side: "blue", lane: "TOP", ready: true, captain: false },
];

const fullRed: SeedRoomMember[] = [
  { username: "hieukm", side: "red", lane: "TOP", ready: true, captain: false },
  { username: "rika", side: "red", lane: "JG", ready: true, captain: false },
  { username: "long2k", side: "red", lane: "MID", ready: true, captain: false },
  { username: "phuct", side: "red", lane: "AD", ready: true, captain: false },
  { username: "nanm", side: "red", lane: "SP", ready: true, captain: false },
];

const LANES: Array<SeedRoomMember["lane"]> = ["TOP", "JG", "MID", "AD", "SP"];

/** Tạo n người chơi riêng biệt cho các phòng khác để không trùng active player giữa các phòng. */
function roomPlayersFromPool(startIndex: number, count: number): SeedRoomMember[] {
  return Array.from({ length: count }, (_, idx) => {
    const num = startIndex + idx;
    const side: "blue" | "red" = idx % 2 === 0 ? "blue" : "red";
    return {
      username: `player_${String(num).padStart(2, "0")}`,
      side,
      lane: LANES[Math.floor(idx / 2) % LANES.length]!,
      ready: true,
      captain: idx === 0 || idx === 1,
    };
  });
}

export const SEED_ROOMS: SeedRoom[] = [
  {
    code: "AOV-1024",
    title: "Kèo giao hữu",
    highlight: "Team A vs B",
    thumbnail: "/mock-assets/room-1.jpg",
    hostUsername: "suthy",
    mode: "normal",
    visibility: "private",
    capacity: 10,
    status: "waiting",
    config: DEFAULT_CONFIG,
    members: [...fullBlue, ...fullRed],
    messages: [
      {
        authorUsername: "suthy",
        text: "Phòng đã mở, mọi người vào đủ rồi thì sẵn sàng nhé.",
        system: false,
        createdAt: "2026-11-15T19:02:00+07:00",
      },
      {
        authorUsername: "hieukm",
        text: "Đã sẵn sàng. Hôm nay random lane hay tự chọn?",
        system: false,
        createdAt: "2026-11-15T19:03:00+07:00",
      },
      {
        authorUsername: "minz",
        text: "Random cho vui đi 😆",
        system: false,
        createdAt: "2026-11-15T19:03:30+07:00",
      },
      {
        authorUsername: "suthy",
        text: "Ok, chia đội xong mình random lane luôn.",
        system: false,
        createdAt: "2026-11-15T19:04:00+07:00",
      },
    ],
  },
  {
    code: "AOV-1025",
    title: "Giao lưu cộng đồng #07",
    highlight: null,
    thumbnail: "/mock-assets/room-2.jpg",
    hostUsername: "hieukm",
    mode: "tournament",
    visibility: "public",
    capacity: 10,
    status: "live",
    config: DEFAULT_CONFIG,
    members: roomPlayersFromPool(1, 10),
    messages: [
      {
        authorUsername: "hieukm",
        text: "Trận bắt đầu rồi, khán giả giữ trật tự giúp mình nhé.",
        system: false,
        createdAt: "2026-11-15T18:40:00+07:00",
      },
      {
        authorUsername: "rika",
        text: "Team Đỏ gánh team đi 💪",
        system: false,
        createdAt: "2026-11-15T18:52:00+07:00",
      },
    ],
  },
  {
    code: "AOV-1026",
    title: "Thử nghiệm tướng mới",
    highlight: null,
    thumbnail: "/mock-assets/room-3.jpg",
    hostUsername: "rika",
    mode: "friendly",
    visibility: "public",
    capacity: 10,
    status: "waiting",
    config: DEFAULT_CONFIG,
    members: roomPlayersFromPool(11, 6),
    messages: [],
  },
  {
    code: "AOV-1027",
    title: "Custom giải trí – All Mid",
    highlight: null,
    thumbnail: "/mock-assets/room-4.jpg",
    hostUsername: "long2k",
    mode: "normal",
    visibility: "public",
    capacity: 10,
    status: "live",
    config: DEFAULT_CONFIG,
    members: roomPlayersFromPool(17, 10),
    messages: [],
  },
  {
    code: "AOV-1028",
    title: "Kèo rank nội bộ",
    highlight: null,
    thumbnail: "/mock-assets/room-5.jpg",
    hostUsername: "phuct",
    mode: "tournament",
    visibility: "private",
    capacity: 10,
    status: "waiting",
    config: DEFAULT_CONFIG,
    members: roomPlayersFromPool(27, 9),
    messages: [],
  },
];
