import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { clay: "#c9673f", ink: "#2b2622" } } },
  plugins: [],
};
export default config;
