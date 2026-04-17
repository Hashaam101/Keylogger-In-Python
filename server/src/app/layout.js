import { Syne, JetBrains_Mono, DM_Sans } from "next/font/google";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata = {
  title: "Keylogger Dashboard",
  description: "A modern log dashboard with structured and raw views.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${syne.variable} ${jetbrainsMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
