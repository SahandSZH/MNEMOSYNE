import "./globals.css";

export const metadata = {
  title: "NeuroCare | Dementia Monitoring Platform",
  description: "Medical-grade dementia monitoring dashboard for patients and doctors.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}