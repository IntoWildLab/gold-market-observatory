import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 中国用户习惯: 红涨绿跌
        up: "#d03050",      // 上涨红
        down: "#0a8f5a",    // 下跌绿
        neutral: "#64748b",
        terminal: {
          bg: "#0d1117",
          panel: "#161b22",
          border: "#2d333b",
          text: "#e6edf3",
          muted: "#8b949e",
          accent: "#d4a72c",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
