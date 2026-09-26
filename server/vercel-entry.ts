import { makeHandler } from './vercel-handler';
export default { fetch: makeHandler(process.env) };
