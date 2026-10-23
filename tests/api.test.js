const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function fixture(file) {
  const entries = [], calls = [];
  let allowed = true;
  const redis = {
    lrange: async () => entries.slice(),
    lpush: async (_, value) => entries.unshift(JSON.parse(value)),
    ltrim: async () => {},
    lrem: async (_, count, value) => { const index = entries.findIndex(e => JSON.stringify(e) === value); if (index >= 0) entries.splice(index, 1); },
    zremrangebyscore: async () => calls.push('prune'),
    zadd: async () => calls.push('add'),
    zrem: async () => calls.push('remove'),
    zcard: async () => 2,
  };
  class Ratelimit {
    constructor(options) { this.prefix = options.prefix; }
    static slidingWindow() { return {}; }
    async limit(ip) { calls.push([this.prefix, ip]); return {success: allowed}; }
  }
  const original = Module._load;
  Module._load = function(name, ...args) {
    if (name === '@upstash/redis') return { Redis: class { constructor() { return redis; } } };
    if (name === '@upstash/ratelimit') return { Ratelimit };
    return original.call(this, name, ...args);
  };
  const resolved = require.resolve('../api/' + file);
  delete require.cache[resolved];
  let handler;
  try { handler = require(resolved); } finally { Module._load = original; }
  return {
    entries, calls, deny: () => { allowed = false; },
    async request(method, body) {
      const response = { statusCode: 200, headers: {}, setHeader(k,v) {this.headers[k]=v;}, status(code) {this.statusCode=code; return this;}, json(data) {this.body=data; return this;} };
      await handler({method, body, headers:{'x-forwarded-for':'192.0.2.1'}, socket:{}}, response);
      return response;
    }
  };
}

test('messages validate JSON and hide cryptographic deletion secrets', async () => {
  const f = fixture('messages.js');
  assert.equal((await f.request('POST','{')).statusCode,400);
  assert.equal((await f.request('POST',{message:' '})).statusCode,400);
  const posted = await f.request('POST',{name:'name',message:'hello'});
  assert.equal(posted.statusCode,201);
  assert.match(posted.body.token,/^[a-f0-9]{64}$/);
  assert.equal(posted.body.entry.token,undefined);
  const list = await f.request('GET');
  assert.equal(list.body.messages[0].token,undefined);
  const id = posted.body.entry.id;
  assert.equal((await f.request('DELETE',{id,token:'wrong'})).statusCode,403);
  assert.equal(f.entries.length,1);
  assert.equal((await f.request('DELETE',{id,token:posted.body.token})).statusCode,200);
  assert.equal(f.entries.length,0);
});

test('posting and deletion are independently rate limited before storage mutation', async () => {
  const f = fixture('messages.js'); f.deny();
  assert.equal((await f.request('POST',{message:'hello'})).statusCode,429);
  const response = await f.request('DELETE',{id:'id',token:'token'});
  assert.equal(response.statusCode,429);
  assert.equal(response.headers['Retry-After'],'60');
  assert.equal(f.entries.length,0);
  assert.deepEqual(f.calls.map(c=>c[0]),['bbs:ratelimit','bbs:delete-ratelimit']);
});

test('presence validates input and rejects excess requests before Redis writes', async () => {
  const f = fixture('presence.js');
  for (const body of ['{', {id:'a'.repeat(65)}, {id:'id',leaving:'false'}]) {
    assert.equal((await f.request('POST',body)).statusCode,400);
  }
  assert.equal(f.calls.length,0);
  assert.equal((await f.request('POST',{id:'visitor-1'})).body.count,2);
  assert.ok(f.calls.includes('add'));
  f.calls.length=0; f.deny();
  assert.equal((await f.request('POST',{id:'visitor-2'})).statusCode,429);
  assert.equal(f.calls.length,1);
});
