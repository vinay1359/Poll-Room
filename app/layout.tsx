import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

export const metadata = {
  title: "Pollbox - Real-time Polls with Anti-Abuse Protection",
  description: "Create polls with real-time updates, transparent anti-spam protection, and instant results. Build polls that stay honest at scale.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 
                  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <Header />
          <main className="page shell">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
