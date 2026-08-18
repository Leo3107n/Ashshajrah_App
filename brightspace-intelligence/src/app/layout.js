import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Ash-Shajrah Learning Hub (ALH) | Online Learning for Values, Creativity & Confidence",
  description:
    "A fully online learning hub for children, parents, and educators â€” focused on early years learning, Montessori-inspired guidance, character, creativity, confidence, and leadership.",
  icons: {
    icon: "/favicon-32.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${cormorant.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="font-body min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
