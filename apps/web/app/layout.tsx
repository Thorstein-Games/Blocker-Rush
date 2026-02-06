import "./globals.css";
import InteractiveGridBackground from "../components/background/InteractiveGridBackground";

export const metadata = {
  title: "Blocker Rush - Play Genius Square Online",
  description:
    "Blocker Rush - fast, friendly puzzle rush game. Play the daily challenge, competetive multiplayer, or fun casual modes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <InteractiveGridBackground />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
