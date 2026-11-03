import { handleRpcRequest } from '@/server/handlers';
import { deps } from '@/server/deps';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (req: Request) => handleRpcRequest(req, deps);
