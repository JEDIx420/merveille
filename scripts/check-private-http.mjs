/** Read-only privacy/containment checks against the built local app. No authenticated writes. */
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8799';
const results=[];
for(const [path,init,status] of [
 ['/api/session',{},401],
 ['/api/projects',{},401],
 ['/api/session',{headers:{'x-merveille-synthetic-principal':'admin',cookie:'merveille_synthetic_principal=admin'}},401],
 ['/api/session',{headers:{'cf-access-jwt-assertion':'eyJhbGciOiJSUzI1NiJ9.e30.invalid'}},401],
 ['/api/files/unknown/download',{},401],
 ['/api/files/unknown/download',{method:'HEAD'},401],
 ['/api/runtime/spike',{},404],
 ['/api/runtime/spike',{method:'POST',headers:{origin:base}},404],
 ['/api/people',{method:'POST',headers:{origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'},403],
 ['/api/people',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:'{}'},401],
 ]){
 const response=await fetch(base+path,init);assert.equal(response.status,status,`${path} ${init.method||'GET'}`);assert.match(response.headers.get('cache-control')||'',/private.*no-store|no-store.*private/);results.push({path,method:init.method||'GET',status:response.status,private:true});
}
const root=await fetch(base+'/',{redirect:'manual'});assert.ok([307,308].includes(root.status));assert.equal(root.headers.get('location'),'/overview');
const login=await fetch(base+'/login');assert.equal(login.status,200);assert.doesNotMatch(await login.text(),/Local Test Identities|Switch Role|merveille_synthetic_principal/);
console.log(JSON.stringify({environment:base,realHTTP:true,authenticatedWrites:0,passed:results,rootRedirect:'/overview',deployedFixtureControls:false},null,2));
