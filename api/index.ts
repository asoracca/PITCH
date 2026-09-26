import { makeHandler } from '../server/vercel-handler';

const fetch = makeHandler(process.env);
export default { fetch };
