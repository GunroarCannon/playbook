import type { Metadata, Viewport } from "next";
import { Architects_Daughter, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hand = Architects_Daughter({ variable: "--font-hand", weight: "400", subsets: ["latin"] });
const sans = IBM_Plex_Sans({ variable: "--font-plex", weight: ["400", "500", "600"], subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jb", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Playbook: a what-if workbench that remembers",
  description:
    "A chatbot workbench that runs simulations with you and remembers your constraints, best results and failures across sessions with Walrus Memory.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#121821" },
  ],
};

// Apply the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('pb-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hand.variable} ${sans.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
