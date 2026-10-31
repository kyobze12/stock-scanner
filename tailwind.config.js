/** Colors, fonts and shadows read the CSS variables in src/styles.css, so every utility follows light/dark. */
module.exports = Object.assign({ content: ['./src/index.html', './src/app.js'] }, {
    theme: {
      extend: {
        colors: {
          bg: "var(--bg)", surface: "var(--surface)", surface2: "var(--surface-2)", fg: "var(--fg)", muted: "var(--muted)",
          line: "var(--line)", accent: "var(--accent)", accent2: "var(--accent-2)", "accent-ink": "var(--accent-ink)", "accent-soft": "var(--accent-soft)",
          laser: "var(--laser)", warn: "var(--warn)", "warn-soft": "var(--warn-soft)", bad: "var(--bad)", "bad-soft": "var(--bad-soft)"
        },
        fontFamily: { display: "var(--f-display)", body: "var(--f-body)", mono: "var(--f-mono)" },
        boxShadow: { card: "var(--shadow)", glow: "0 0 0 1px var(--accent-soft), 0 12px 40px -8px var(--accent)" }
      }
    }
  });
