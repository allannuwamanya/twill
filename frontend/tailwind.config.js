/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        vesper: {
          bg: "#101010",
          surface: "#161616",
          card: "#181818",
          elevated: "#202020",
          border: "#242424",
          "border-subtle": "#1c1c1c",
          amber: "#ffc799",
          orange: "#ff9940",
          yellow: "#fbeab4",
          green: "#99ffe4",
          red: "#ff657a",
          muted: "#8c8c8c",
          dim: "#555555",
          highlight: "#282828",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  // prose/prose-invert (ChatBubble) and animate-in/fade-in (ApprovalDialog)
  // generate nothing without these plugins — they were silently dead classes.
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwindcss-animate"),
  ],
}
