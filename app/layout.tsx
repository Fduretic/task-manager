import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Taskline · Task Manager',
  description: 'A focused workspace for your team. Private tasks, thoughtful collaboration.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
