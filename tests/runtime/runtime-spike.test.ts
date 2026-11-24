import {it,expect} from 'vitest';
import {GET,POST,HEAD} from '@/app/api/runtime/spike/route';
it('retired diagnostics reject every verb without requiring bindings or touching storage',async()=>{for(const method of [GET,POST,HEAD]){const r=method();expect(r.status).toBe(404);}});
