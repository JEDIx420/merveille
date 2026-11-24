import {it,expect} from 'vitest';
import {hasCapability} from '@/server/auth/principal';
it('capabilities combine without falling through to an implicit role',()=>{const p:any={role:'OWNER',roles:['OWNER','ADMIN'],projectMemberships:[{projectId:'a',roles:['MANAGER']},{projectId:'b',roles:['CLIENT_REP']}]};expect(hasCapability(p,'ADMIN')).toBe(true);expect(hasCapability(p,'OWNER')).toBe(true);expect(hasCapability(p,'MANAGER','a')).toBe(true);expect(hasCapability(p,'MANAGER','b')).toBe(false);expect(hasCapability({...p,roles:[]},'OWNER')).toBe(false);});
