import path from 'node:path';

import dotenv from 'dotenv';

const __dirname = path.dirname(import.meta.url).replace('file://', '');

dotenv.config({ path: path.resolve(__dirname, '.env') });
