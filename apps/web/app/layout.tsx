import "./globals.css";

export const metadata = {
  title: "Blocker Rush",
  description: "Blocker Rush - fast, friendly puzzle rush.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
