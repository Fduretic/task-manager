import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, sessionUser } from '@/lib/auth';
import { Board } from '@/components/board';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await sessionUser((await cookies()).get(COOKIE)?.value);
  if (!user) redirect('/login');
  return <Board user={user} />;
}
