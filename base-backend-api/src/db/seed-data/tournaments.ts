// Nguồn: base-frontend-web/src/mocks/tournaments.ts, base-frontend-web/src/mocks/clock.ts (MOCK_TODAY = 2026-11-15)

import type { TournamentPrizeJson } from "../schema.js";

export interface SeedTeamDef {
  key: string;
  name: string;
  logo: string;
  status?: "pending" | "approved" | "rejected" | "withdrawn";
}

export interface SeedBracketMatch {
  round: number;
  position: number;
  label: string;
  teamAKey: string | null;
  teamBKey: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerKey: string | null;
  isBye?: boolean;
  scheduledAt: string | null;
  nextSlot: "a" | "b" | null;
}

export interface SeedTournament {
  slug: string;
  name: string;
  titleAccent: string | null;
  description: string;
  intro: string[];
  organizerUsername: string;
  status: "open" | "live" | "finished";
  teamCount: number;
  series: "BO1" | "BO3" | "BO5";
  cover: string;
  registrationDeadline: string;
  drawDate: string;
  dateStart: string;
  dateEnd: string;
  createdAt: string;
  rules: string[];
  prizes: TournamentPrizeJson[];
  teams: SeedTeamDef[];
  bracket: SeedBracketMatch[];
  championTeamKey: string | null;
}

const team = (key: string, name: string, logoId = key): SeedTeamDef => ({
  key,
  name,
  logo: `/mock-assets/team-${logoId}.png`,
});

export const SEED_TEAMS = {
  xanh: team("xanh", "Team Xanh"),
  haiphong: team("haiphong", "Hải Phòng AOV"),
  do: team("do", "Team Đỏ"),
  shadow: team("shadow", "Shadow Esports"),
  rongthan: team("rongthan", "Rồng Thần"),
  aovelite: team("aovelite", "AOV Elite"),
  nguho: team("nguho", "Ngũ Hổ"),
  alpha: team("alpha", "Team Alpha"),
  soidem: team("soidem", "Sói Đêm", "shadow"),
  phuonghoang: team("phuonghoang", "Phượng Hoàng", "do"),
  bachho: team("bachho", "Bạch Hổ", "nguho"),
  thienlong: team("thienlong", "Thiên Long", "rongthan"),
  kylan: team("kylan", "Kỳ Lân", "xanh"),
  loiho: team("loiho", "Lôi Hổ", "alpha"),
} as const;

const EIGHT_TEAMS: SeedTeamDef[] = [
  SEED_TEAMS.xanh,
  SEED_TEAMS.haiphong,
  SEED_TEAMS.do,
  SEED_TEAMS.shadow,
  SEED_TEAMS.rongthan,
  SEED_TEAMS.aovelite,
  SEED_TEAMS.nguho,
  SEED_TEAMS.alpha,
];

const NGU_KIET_REGISTERED: SeedTeamDef[] = [
  ...EIGHT_TEAMS,
  SEED_TEAMS.soidem,
  SEED_TEAMS.phuonghoang,
  SEED_TEAMS.bachho,
];

const SINH_VIEN_REGISTERED: SeedTeamDef[] = [
  SEED_TEAMS.kylan,
  SEED_TEAMS.thienlong,
  SEED_TEAMS.loiho,
  SEED_TEAMS.soidem,
  SEED_TEAMS.phuonghoang,
];

const LIEN_SERVER_REGISTERED: SeedTeamDef[] = [
  SEED_TEAMS.nguho,
  SEED_TEAMS.shadow,
  SEED_TEAMS.thienlong,
  SEED_TEAMS.bachho,
];

const WEEKEND_TEAMS: SeedTeamDef[] = [
  SEED_TEAMS.kylan,
  SEED_TEAMS.do,
  SEED_TEAMS.loiho,
  SEED_TEAMS.haiphong,
  SEED_TEAMS.thienlong,
  SEED_TEAMS.shadow,
  SEED_TEAMS.soidem,
  SEED_TEAMS.xanh,
];

const FRIDAY_TEAMS: SeedTeamDef[] = [
  SEED_TEAMS.phuonghoang,
  SEED_TEAMS.nguho,
  SEED_TEAMS.bachho,
  SEED_TEAMS.alpha,
  SEED_TEAMS.rongthan,
  SEED_TEAMS.kylan,
  SEED_TEAMS.aovelite,
  SEED_TEAMS.loiho,
];

const AUTUMN_TEAMS: SeedTeamDef[] = [
  SEED_TEAMS.alpha,
  SEED_TEAMS.thienlong,
  SEED_TEAMS.xanh,
  SEED_TEAMS.bachho,
  SEED_TEAMS.shadow,
  SEED_TEAMS.do,
  SEED_TEAMS.nguho,
  SEED_TEAMS.haiphong,
];

const DEFAULT_RULES = [
  "Mỗi đội 5 người chính + tối đa 2 dự bị, đăng ký bằng tài khoản customAOV.",
  "Thi đấu chế độ Custom 5v5, cấm/chọn theo luật giải (Draft Pick).",
  "Có mặt trong phòng trước giờ thi đấu 15 phút; trễ quá 10 phút xử thua ván.",
  "Tôn trọng đối thủ, không sử dụng phần mềm thứ ba. Vi phạm sẽ bị loại.",
];

const POINT_PRIZES: TournamentPrizeJson[] = [
  { place: "Vô địch", reward: "200 điểm xếp hạng cộng đồng" },
  { place: "Á quân", reward: "120 điểm" },
  { place: "Hạng ba", reward: "80 điểm" },
];

/** Chuyển "14/11 19:00" -> "2026-11-14T19:00:00+07:00" */
function toIso2026(ddmmTime: string): string {
  const [datePart = "01/01", timePart = "19:00"] = ddmmTime.split(" ");
  const [dd = "01", mm = "01"] = datePart.split("/");
  return `2026-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${timePart}:00+07:00`;
}

function knockoutBracket(
  entrants: SeedTeamDef[],
  times: [string[], string[], string],
  played: 2 | 3,
  upsets: number[] = [],
  bo: [string, string, string] = ["BO3", "BO3", "BO5"],
): { bracket: SeedBracketMatch[]; championKey: string | null } {
  let idx = 0;
  const play = (
    round: number,
    position: number,
    label: string,
    time: string,
    a: SeedTeamDef,
    b: SeedTeamDef,
    done: boolean,
    isFinal: boolean,
  ): { match: SeedBracketMatch; winner: SeedTeamDef } => {
    const i = idx++;
    const nextSlot = isFinal ? null : position % 2 === 0 ? "a" : "b";
    if (!done) {
      return {
        match: {
          round,
          position,
          label,
          teamAKey: a.key,
          teamBKey: b.key,
          scoreA: null,
          scoreB: null,
          winnerKey: null,
          scheduledAt: toIso2026(time),
          nextSlot,
        },
        winner: a,
      };
    }

    const win = isFinal ? 3 : bo[i < 4 ? 0 : 1] === "BO1" ? 1 : 2;
    const lose = isFinal ? i % 3 : bo[i < 4 ? 0 : 1] === "BO1" ? 0 : i % 2;
    const second = upsets.includes(i);
    const winner = second ? b : a;
    return {
      match: {
        round,
        position,
        label,
        teamAKey: a.key,
        teamBKey: b.key,
        scoreA: second ? lose : win,
        scoreB: second ? win : lose,
        winnerKey: winner.key,
        scheduledAt: toIso2026(time),
        nextSlot,
      },
      winner,
    };
  };

  const qf = [0, 1, 2, 3].map((k) =>
    play(
      1,
      k,
      `Trận ${k + 1}`,
      times[0][k] ?? "15/11 19:00",
      entrants[k * 2]!,
      entrants[k * 2 + 1]!,
      true,
      false,
    ),
  );
  const sf = [0, 1].map((k) =>
    play(
      2,
      k,
      `Trận ${k + 5}`,
      times[1][k] ?? "15/11 20:30",
      qf[k * 2]!.winner,
      qf[k * 2 + 1]!.winner,
      true,
      false,
    ),
  );
  const fin = play(
    3,
    0,
    "Chung kết",
    times[2],
    sf[0]!.winner,
    sf[1]!.winner,
    played === 3,
    true,
  );

  return {
    bracket: [
      ...qf.map((x) => x.match),
      ...sf.map((x) => x.match),
      fin.match,
    ],
    championKey: played === 3 ? fin.match.winnerKey : null,
  };
}

const weekendData = knockoutBracket(
  WEEKEND_TEAMS,
  [
    ["14/11 19:00", "14/11 20:00", "14/11 21:00", "14/11 22:00"],
    ["15/11 19:00", "15/11 20:30"],
    "16/11 20:00",
  ],
  2,
  [1, 5],
);

const fridayData = knockoutBracket(
  FRIDAY_TEAMS,
  [
    ["06/11 19:00", "06/11 19:45", "06/11 20:30", "06/11 21:15"],
    ["07/11 19:00", "07/11 20:30"],
    "07/11 22:00",
  ],
  3,
  [0, 2, 6],
  ["BO1", "BO3", "BO5"],
);

const autumnData = knockoutBracket(
  AUTUMN_TEAMS,
  [
    ["25/10 19:00", "25/10 20:30", "26/10 19:00", "26/10 20:30"],
    ["01/11 19:00", "01/11 20:30"],
    "02/11 20:00",
  ],
  3,
  [3],
);

export const SEED_TOURNAMENTS: SeedTournament[] = [
  {
    slug: "ngu-kiet-cup-mua-1",
    name: "Ngũ Kiệt Cup – Mùa 1",
    titleAccent: "1",
    description:
      "Giải đấu cộng đồng 5v5 quy mô toàn server, sân chơi cho các đội custom tranh tài và khẳng định sức mạnh.",
    intro: [
      "Giải đấu cộng đồng 5v5 dành cho toàn thể người chơi Custom AOV.",
      "Quy tụ các đội tuyển mạnh nhất, tranh tài để tìm ra Ngũ Kiệt mùa đầu tiên!",
    ],
    organizerUsername: "suthy",
    status: "open",
    teamCount: 16,
    series: "BO3",
    cover: "/mock-assets/tour-1.jpg",
    registrationDeadline: "2026-11-20T23:59:00+07:00",
    drawDate: "2026-11-21T19:00:00+07:00",
    dateStart: "2026-11-22T19:00:00+07:00",
    dateEnd: "2026-11-27T22:00:00+07:00",
    createdAt: "2026-11-14T10:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: [
      { place: "Vô địch", reward: "3.000.000đ + Cúp Ngũ Kiệt" },
      { place: "Á quân", reward: "1.500.000đ" },
      { place: "Hạng ba", reward: "500.000đ" },
    ],
    teams: NGU_KIET_REGISTERED,
    bracket: [],
    championTeamKey: null,
  },
  {
    slug: "custom-league-3",
    name: "Custom League #3",
    titleAccent: "#3",
    description:
      "Series giải đấu giao hữu định kỳ, nơi các đội custom rèn luyện, cọ xát và tích lũy điểm xếp hạng cộng đồng.",
    intro: [
      "Series giải giao hữu định kỳ của Đấu Trường Lập Đội.",
      "Vòng bảng đã khép lại — 8 đội mạnh nhất bước vào nhánh loại trực tiếp.",
    ],
    organizerUsername: "hieukm",
    status: "live",
    teamCount: 8,
    series: "BO3",
    cover: "/mock-assets/tour-2.jpg",
    registrationDeadline: "2026-11-08T23:59:00+07:00",
    drawDate: "2026-11-09T19:00:00+07:00",
    dateStart: "2026-11-10T19:00:00+07:00",
    dateEnd: "2026-11-24T22:00:00+07:00",
    createdAt: "2026-11-05T10:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: POINT_PRIZES,
    teams: EIGHT_TEAMS,
    bracket: [
      {
        round: 1,
        position: 0,
        label: "Trận 1",
        teamAKey: "xanh",
        teamBKey: "haiphong",
        scoreA: 2,
        scoreB: 0,
        winnerKey: "xanh",
        scheduledAt: toIso2026("13/11 19:00"),
        nextSlot: "a",
      },
      {
        round: 1,
        position: 1,
        label: "Trận 2",
        teamAKey: "do",
        teamBKey: "shadow",
        scoreA: 2,
        scoreB: 1,
        winnerKey: "do",
        scheduledAt: toIso2026("13/11 20:30"),
        nextSlot: "b",
      },
      {
        round: 1,
        position: 2,
        label: "Trận 3",
        teamAKey: "rongthan",
        teamBKey: "aovelite",
        scoreA: 1,
        scoreB: 2,
        winnerKey: "aovelite",
        scheduledAt: toIso2026("14/11 19:00"),
        nextSlot: "a",
      },
      {
        round: 1,
        position: 3,
        label: "Trận 4",
        teamAKey: "nguho",
        teamBKey: "alpha",
        scoreA: 0,
        scoreB: 2,
        winnerKey: "alpha",
        scheduledAt: toIso2026("14/11 20:30"),
        nextSlot: "b",
      },
      {
        round: 2,
        position: 0,
        label: "Trận 5",
        teamAKey: "xanh",
        teamBKey: "do",
        scoreA: 2,
        scoreB: 1,
        winnerKey: "xanh",
        scheduledAt: toIso2026("15/11 14:00"),
        nextSlot: "a",
      },
      {
        round: 2,
        position: 1,
        label: "Trận 6",
        teamAKey: "aovelite",
        teamBKey: "alpha",
        scoreA: 0,
        scoreB: 2,
        winnerKey: "alpha",
        scheduledAt: toIso2026("15/11 16:00"),
        nextSlot: "b",
      },
      {
        round: 3,
        position: 0,
        label: "Chung kết",
        teamAKey: "xanh",
        teamBKey: "alpha",
        scoreA: null,
        scoreB: null,
        winnerKey: null,
        scheduledAt: toIso2026("24/11 20:00"),
        nextSlot: null,
      },
    ],
    championTeamKey: null,
  },
  {
    slug: "hoi-lang-keo-vui",
    name: "Hội Làng Kèo Vui",
    titleAccent: "Kèo Vui",
    description:
      "Giải đấu giải trí dành cho cộng đồng yêu custom, đề cao tinh thần vui vẻ, giao lưu và gắn kết.",
    intro: [
      "Giải đấu giải trí cho cộng đồng yêu custom, đề cao tinh thần vui vẻ.",
      "Chúc mừng Ngũ Hổ đã lên ngôi vô địch!",
    ],
    organizerUsername: "rika",
    status: "finished",
    teamCount: 8,
    series: "BO3",
    cover: "/mock-assets/tour-3.jpg",
    registrationDeadline: "2026-11-03T23:59:00+07:00",
    drawDate: "2026-11-04T19:00:00+07:00",
    dateStart: "2026-11-05T19:00:00+07:00",
    dateEnd: "2026-11-12T22:00:00+07:00",
    createdAt: "2026-11-01T10:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: [
      { place: "Vô địch", reward: 'Danh hiệu "Vua Kèo Vui"' },
      { place: "Á quân", reward: "Khung avatar giới hạn" },
    ],
    teams: EIGHT_TEAMS,
    bracket: [
      {
        round: 1,
        position: 0,
        label: "Trận 1",
        teamAKey: "nguho",
        teamBKey: "shadow",
        scoreA: 1,
        scoreB: 0,
        winnerKey: "nguho",
        scheduledAt: toIso2026("08/11 19:00"),
        nextSlot: "a",
      },
      {
        round: 1,
        position: 1,
        label: "Trận 2",
        teamAKey: "haiphong",
        teamBKey: "rongthan",
        scoreA: 0,
        scoreB: 1,
        winnerKey: "rongthan",
        scheduledAt: toIso2026("08/11 20:00"),
        nextSlot: "b",
      },
      {
        round: 1,
        position: 2,
        label: "Trận 3",
        teamAKey: "alpha",
        teamBKey: "xanh",
        scoreA: 1,
        scoreB: 0,
        winnerKey: "alpha",
        scheduledAt: toIso2026("09/11 19:00"),
        nextSlot: "a",
      },
      {
        round: 1,
        position: 3,
        label: "Trận 4",
        teamAKey: "do",
        teamBKey: "aovelite",
        scoreA: 1,
        scoreB: 0,
        winnerKey: "do",
        scheduledAt: toIso2026("09/11 20:00"),
        nextSlot: "b",
      },
      {
        round: 2,
        position: 0,
        label: "Trận 5",
        teamAKey: "nguho",
        teamBKey: "rongthan",
        scoreA: 2,
        scoreB: 1,
        winnerKey: "nguho",
        scheduledAt: toIso2026("11/11 19:00"),
        nextSlot: "a",
      },
      {
        round: 2,
        position: 1,
        label: "Trận 6",
        teamAKey: "alpha",
        teamBKey: "do",
        scoreA: 1,
        scoreB: 2,
        winnerKey: "do",
        scheduledAt: toIso2026("11/11 20:30"),
        nextSlot: "b",
      },
      {
        round: 3,
        position: 0,
        label: "Chung kết",
        teamAKey: "nguho",
        teamBKey: "do",
        scoreA: 3,
        scoreB: 1,
        winnerKey: "nguho",
        scheduledAt: toIso2026("12/11 20:00"),
        nextSlot: null,
      },
    ],
    championTeamKey: "nguho",
  },
  {
    slug: "dai-chien-lien-server",
    name: "Đại Chiến Liên Server",
    titleAccent: null,
    description:
      "Các đội đại diện từng server so tài trong thể thức loại trực tiếp 16 đội, tìm ra server mạnh nhất mùa đông.",
    intro: [
      "Các đội đại diện từng server so tài trong thể thức loại trực tiếp 16 đội, tìm ra server mạnh nhất mùa đông.",
    ],
    organizerUsername: "suthy",
    status: "open",
    teamCount: 16,
    series: "BO3",
    cover: "/mock-assets/tour-1.jpg",
    registrationDeadline: "2026-11-30T23:59:00+07:00",
    drawDate: "2026-12-01T19:00:00+07:00",
    dateStart: "2026-12-05T19:00:00+07:00",
    dateEnd: "2026-12-14T22:00:00+07:00",
    createdAt: "2026-11-15T08:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: [
      { place: "Vô địch", reward: "5.000.000đ + Cúp Liên Server" },
      { place: "Á quân", reward: "2.000.000đ" },
      { place: "Hạng ba", reward: "1.000.000đ" },
    ],
    teams: LIEN_SERVER_REGISTERED,
    bracket: [],
    championTeamKey: null,
  },
  {
    slug: "dau-truong-sinh-vien-2026",
    name: "Đấu Trường Sinh Viên 2026",
    titleAccent: null,
    description:
      "Giải đấu dành cho các đội sinh viên, thi đấu cuối tuần, giao lưu giữa các câu lạc bộ Liên Quân trường học.",
    intro: [
      "Giải đấu dành cho các đội sinh viên, thi đấu cuối tuần, giao lưu giữa các câu lạc bộ Liên Quân trường học.",
    ],
    organizerUsername: "vanhh",
    status: "open",
    teamCount: 8,
    series: "BO3",
    cover: "/mock-assets/tour-1.jpg",
    registrationDeadline: "2026-11-25T23:59:00+07:00",
    drawDate: "2026-11-26T19:00:00+07:00",
    dateStart: "2026-11-28T19:00:00+07:00",
    dateEnd: "2026-11-30T22:00:00+07:00",
    createdAt: "2026-11-12T10:00:00+07:00",
    rules: [
      ...DEFAULT_RULES,
      "Thành viên phải là sinh viên đang theo học; ban tổ chức có thể yêu cầu xác minh.",
    ],
    prizes: [
      { place: "Vô địch", reward: "1.000.000đ + Học bổng CLB" },
      { place: "Á quân", reward: "500.000đ" },
    ],
    teams: SINH_VIEN_REGISTERED,
    bracket: [],
    championTeamKey: null,
  },
  {
    slug: "giai-cuoi-tuan-12",
    name: "Giải Cuối Tuần #12",
    titleAccent: null,
    description:
      "Giải nhanh 3 ngày cuối tuần: tứ kết thứ Sáu, bán kết thứ Bảy, chung kết tối Chủ nhật.",
    intro: [
      "Giải nhanh 3 ngày cuối tuần: tứ kết thứ Sáu, bán kết thứ Bảy, chung kết tối Chủ nhật.",
    ],
    organizerUsername: "long2k",
    status: "live",
    teamCount: 8,
    series: "BO3",
    cover: "/mock-assets/tour-2.jpg",
    registrationDeadline: "2026-11-12T23:59:00+07:00",
    drawDate: "2026-11-13T19:00:00+07:00",
    dateStart: "2026-11-14T19:00:00+07:00",
    dateEnd: "2026-11-16T22:00:00+07:00",
    createdAt: "2026-11-08T10:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: POINT_PRIZES,
    teams: WEEKEND_TEAMS,
    bracket: weekendData.bracket,
    championTeamKey: weekendData.championKey,
  },
  {
    slug: "keo-dem-thu-sau-7",
    name: "Kèo Đêm Thứ Sáu #7",
    titleAccent: null,
    description:
      "Kèo đêm giao lưu hằng tuần, thể thức BO1 gọn nhẹ, đá xong trong 2 buổi tối.",
    intro: [
      "Kèo đêm giao lưu hằng tuần, thể thức BO1 gọn nhẹ, đá xong trong 2 buổi tối.",
    ],
    organizerUsername: "phuct",
    status: "finished",
    teamCount: 8,
    series: "BO1",
    cover: "/mock-assets/tour-3.jpg",
    registrationDeadline: "2026-11-04T23:59:00+07:00",
    drawDate: "2026-11-05T19:00:00+07:00",
    dateStart: "2026-11-06T19:00:00+07:00",
    dateEnd: "2026-11-07T23:00:00+07:00",
    createdAt: "2026-10-30T10:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: [{ place: "Vô địch", reward: 'Danh hiệu "Cú Đêm"' }],
    teams: FRIDAY_TEAMS,
    bracket: fridayData.bracket,
    championTeamKey: fridayData.championKey,
  },
  {
    slug: "cup-mua-thu-2026",
    name: "Cup Mùa Thu 2026",
    titleAccent: null,
    description:
      "Giải cộng đồng mùa thu, tiền thân của Ngũ Kiệt Cup. Team Alpha lên ngôi sau loạt chung kết BO5.",
    intro: [
      "Giải cộng đồng mùa thu, tiền thân của Ngũ Kiệt Cup. Team Alpha lên ngôi sau loạt chung kết BO5.",
    ],
    organizerUsername: "suthy",
    status: "finished",
    teamCount: 8,
    series: "BO3",
    cover: "/mock-assets/tour-3.jpg",
    registrationDeadline: "2026-10-18T23:59:00+07:00",
    drawDate: "2026-10-19T19:00:00+07:00",
    dateStart: "2026-10-20T19:00:00+07:00",
    dateEnd: "2026-11-02T22:00:00+07:00",
    createdAt: "2026-10-10T10:00:00+07:00",
    rules: DEFAULT_RULES,
    prizes: [
      { place: "Vô địch", reward: "2.000.000đ" },
      { place: "Á quân", reward: "1.000.000đ" },
      { place: "Hạng ba", reward: "500.000đ" },
    ],
    teams: AUTUMN_TEAMS,
    bracket: autumnData.bracket,
    championTeamKey: autumnData.championKey,
  },
];
