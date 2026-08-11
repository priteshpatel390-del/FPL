import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudflareAccessFetch, cloudflareAuthVerifier } from '../workers/evidence-archive.mjs';

const b64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');

test('Cloudflare Access adapter converts unsupported error redirects to fail-closed manual mode', async () => {
  const calls=[];
  const fetchFn=async(input,init={})=>{
    calls.push({input,init});
    return new Response(null,{status:302,headers:{Location:'https://example.invalid/'}});
  };
  const response=await cloudflareAccessFetch(fetchFn)(
    'https://team.cloudflareaccess.com/cdn-cgi/access/certs',
    {headers:{Accept:'application/json'},redirect:'error'}
  );
  assert.equal(response.status,302);
  assert.equal(calls.length,1);
  assert.equal(calls[0].init.redirect,'manual');
  assert.equal(calls[0].init.headers.Accept,'application/json');
});

test('Cloudflare Access adapter leaves supported redirect modes unchanged', async () => {
  const seen=[];
  const adapted=cloudflareAccessFetch(async(_input,init={})=>{
    seen.push(init.redirect);
    return new Response('{}',{status:200});
  });
  await adapted('https://example.com',{redirect:'follow'});
  await adapted('https://example.com',{redirect:'manual'});
  assert.deepEqual(seen,['follow','manual']);
});

test('Cloudflare auth verifier wires the manual redirect adapter into Access JWKS loading', async () => {
  const issuer='https://redirect-test.cloudflareaccess.com';
  const token=[
    b64url({alg:'RS256',kid:'kid-1',typ:'JWT'}),
    b64url({iss:issuer,aud:'aud',sub:'owner',exp:4102444800}),
    Buffer.from('synthetic-signature').toString('base64url')
  ].join('.');
  const calls=[];
  const request=new Request('https://evidence.example/v1/health',{headers:{'Cf-Access-Jwt-Assertion':token}});
  await assert.rejects(
    ()=>cloudflareAuthVerifier(request,{TEAM_DOMAIN:issuer,POLICY_AUD:'aud'},{
      fetchFn:async(input,init={})=>{
        calls.push({input,init});
        return new Response(null,{status:302,headers:{Location:'https://example.invalid/'}});
      }
    }),
    error=>error?.code==='auth_keys_unavailable'
  );
  assert.equal(calls.length,1);
  assert.equal(calls[0].init.redirect,'manual');
});
