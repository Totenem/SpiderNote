import { generate } from '../../server/generation';
export function POST(request:Request){return generate(request);}
