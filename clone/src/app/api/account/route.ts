import { handleDeleteAccount } from '@/server/handlers';
import { deps } from '@/server/deps';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const DELETE = (req: Request) => handleDeleteAccount(req, deps);
