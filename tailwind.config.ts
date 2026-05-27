import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        sea: "#0e7490",
        coral: "#f9735b",
        mint: "#dff8ee",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(20, 33, 61, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
