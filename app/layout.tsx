import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BarberBook | Online Booking",
  description: "Κλείσε εύκολα το επόμενο ραντεβού σου.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
