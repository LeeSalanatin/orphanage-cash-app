import { getSession } from '@/lib/auth';
import HeaderClient from './HeaderClient';

export default async function Header() {
  const session = await getSession();

  return <HeaderClient session={session} />;
}
