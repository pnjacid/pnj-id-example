import './globals.css';

export const metadata = {
  title: 'Contoh Next.js PNJ ID',
  description: 'Contoh login PNJ ID, profil OIDC, dan akses API dengan Next.js.'
};

export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}
