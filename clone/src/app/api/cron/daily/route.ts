import { handleCron } from '@/server/handlers';
import { deps } from '@/server/deps';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handleCron(req, deps);
